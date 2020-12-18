const morgan = require('morgan')
const express = require('express')
const sha1 = require('sha1')
const mysql = require('mysql2/promise')
const {MongoClient} = require('mongodb')
const AWS = require('aws-sdk')
const multer = require('multer')
const fs = require('fs')
const { errorMonitor } = require('stream')
const { ESPIPE } = require('constants')
require('dotenv').config()

const PORT = parseInt(process.argv[2]) || parseInt(process.env.PORT) || 3000

const app = express()
app.use(express.urlencoded({extended: true}))
app.use(morgan('combined'))
app.use(express.static(__dirname + '/frontend'))

//#AWS S3
const AWS_S3_HOSTNAME = process.env.AWS_S3_HOSTNAME
const AWS_S3_ACCESS_KEY = process.env.AWS_S3_ACCESS_KEY
const AWS_S3_SECRET_ACCESS_KEY = process.env.AWS_S3_SECRET_ACCESS_KEY
const AWS_S3_BUCKETNAME = process.env.AWS_S3_BUCKETNAME
//set up S3 Endpoint object
const spaceEndpoint = new AWS.Endpoint(AWS_S3_HOSTNAME) //pass hostname here

//create s3 bucket
const s3 = new AWS.S3({
    endpoint: spaceEndpoint,
    accessKeyId: AWS_S3_ACCESS_KEY,
    secretAccessKey: AWS_S3_SECRET_ACCESS_KEY
})

//#mysql
const pool = mysql.createPool({
    host: process.env.MYSQL_SERVER,
    port: process.env.MYSQL_SVR_PORT,
    user: process.env.MYSQL_USERNAME, 
    password: process.env.MYSQL_PASSWORD,
    connectionLimit: process.env.MYSQL_CONN_LIMIT,
    database: process.env.MYSQL_SCHEMA,
    timezone: '+08:00'
})

const SQL_GET_LOGIN_DETAILS = `select * from user where user_id = ? and password = ?`

const startSQL = async(pool) => {
    const conn = await pool.getConnection()
    try{
        await conn.ping()
    }catch(e){
        console.error('Error connecting to mysql: ', e)
    }finally{
        conn.release()
    }
}
const mkQuery = (sqlStmt, pool) => {
    return (async (args) => {
        const conn = await pool.getConnection()
        try {
            let results = await conn.query(sqlStmt, args || [])
            return results[0] //results is [data, metadata]
        }catch(err){
            console.error(err)
        }finally{
            conn.release() // always release when you end query
        }
    })
}

const checkLoginDataWithSQL = mkQuery(SQL_GET_LOGIN_DETAILS, pool)

//#mongo
const MONGO_URL = 'mongodb://localhost:27017'
const client = new MongoClient(MONGO_URL, { useNewUrlParser: true, useUnifiedTopology: true });
const MONGO_DATABASE = process.env.MONGO_DATABASE
const MONGO_COLLECTION = process.env.MONGO_COLLECTION


//POST /checklogin #mysql
app.post('/checklogin', express.json(), async(req, resp) => {
	const data = req.body
	const user_id = data.user_id
	const password = sha1(data.password)
	//console.log("rcvd from ng: ", data)
	const result = await checkLoginDataWithSQL([user_id, password])
	//console.log("result from sql: ", result)

	resp.type('application/json')
	if(result.length <= 0){
		resp.status(401).end()
	}else{
		resp.status(200).end()

	}
})

//#multer
const upload = multer({dest: process.env.TMP_DIR || './temp'})


//POST sharecontent #aws
app.post('/sharecontent', upload.single('image-file'), async(req, resp) => {
	const contentText = req.body
	const contentFile = req.file
	//console.log("user_id and pw:  ", contentText.user_id, contentText.password)
	const user_id = contentText.user_id
	const password = sha1(contentText.password)
	//console.log("pw: ", password)
	const result = await checkLoginDataWithSQL([user_id, password])

	resp.type('application/json')
	if(result.length <= 0){
		resp.status(401).end()
		return
	}

	//INSERT IMAGE INTO S3

	const uploadToS3 = new Promise((resolve, reject) => {
		fs.readFile(req.file.path, (err, buff) => {
			console.log("filepath: ", req.file.path)
			const params = {
				Bucket: AWS_S3_BUCKETNAME,
				Key: req.file.filename,
				Body: buff,
				ACL: 'public-read',
				ContentType: req.file.mimetype,
				ContentLength: req.file.size,
				Metadata: {
					originalName: req.file.originalname,
				}
			}
			s3.putObject(params, (error, result) => {
				if(result) resolve("s3 upload ok ", result)
				else reject("upload to s3 failed ", err)
			})
			
		})
	})
	uploadToS3
		.then(() =>{
		//return objectid
		const insertedLogId = insertIntoMongo(contentText, contentFile.filename)
		return insertedLogId
		}).then(result => {

			console.log("result from Mongo", result)
			resp.status(200).json({insertedId: result})
			resp.on('finish', () => {
				fs.unlink(req.file.path, () => {})
				console.info('>>> response ended')
       		})
		}).catch( err => {
			console.error("error with uploading sequence: ", err)
			resp.status(500).json(err)
		})
})

const mkShare = (data, fileKey) => {
	return {
		title: data.title, 
		comments: data.comments,
		reference: fileKey,
		ts: new Date()
	}
}

async function insertIntoMongo(data, fileKey){
	//console.log("can proceed to mongo")
	//add title, comments, filekey, timestamp to mongo

	const result = await client.db(MONGO_DATABASE).collection(MONGO_COLLECTION).insertOne(mkShare(data, fileKey))
	console.log("result from mongo insert: ", result.ops)	
	return result.ops[0]['_id']	
}



const getMongoConnection = client.connect()

Promise.all([startSQL(pool), getMongoConnection]).then(
	app.listen(PORT, () => {
		console.info(`Application started on port ${PORT} at ${new Date()}`)
	})
).catch(e => {
	console.error("sql not starting: ", e)
})

