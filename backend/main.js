const morgan = require('morgan')
const express = require('express')
const sha1 = require('sha1')
const mysql = require('mysql2/promise')
const {MongoClient, ObjectId} = require('mongodb')
const AWS = require('aws-sdk')
const multer = require('multer')
const fs = require('fs')
require('dotenv').config()

const PORT = parseInt(process.argv[2]) || parseInt(process.env.PORT) || 3000

const app = express()
app.use(express.urlencoded({extended: true}))
app.use(express.json())

app.use(morgan('combined'))


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

//POST /checklogin
app.post('/checklogin', async(req, resp) => {
	const data = req.body
	const user_id = data.user_id
	const password = sha1(data.password)
	console.log("rcvd from ng: ", data)
	const result = await checkLoginDataWithSQL([user_id, password])
	console.log("result from sql: ", result)

	resp.type('application/json')
	if(result.length <= 0){
		resp.status(401).end()
	}else{
		resp.status(200).end()

	}

})


startSQL(pool).then(
	app.listen(PORT, () => {
		console.info(`Application started on port ${PORT} at ${new Date()}`)
	})
).catch(e => {
	console.error("sql not starting: ", e)
})

