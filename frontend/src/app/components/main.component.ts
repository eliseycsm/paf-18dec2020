import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthenSvc } from '../app.authen';
import {CameraService} from '../camera.service';
import { ShareService } from '../share.service';

@Component({
  selector: 'app-main',
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.css']
})
export class MainComponent implements OnInit {

	imagePath = '/assets/cactus.png'
	form: FormGroup
	noCamImage: Boolean = true

	constructor(private cameraSvc: CameraService,
		private fb: FormBuilder, private authenSvc: AuthenSvc,
		private shareSvc: ShareService, private router: Router) { }

	ngOnInit(): void {
	  if (this.cameraSvc.hasImage()) {
		  const img = this.cameraSvc.getImage()
		  this.imagePath = img.imageAsDataUrl
		  this.noCamImage = false
	  }

	  this.form = this.fb.group({
		title: this.fb.control('', [Validators.required]),
		comments: this.fb.control('', [Validators.required])
	  })
	  

	}

	clear() {
		this.form.reset()
		this.imagePath = '/assets/cactus.png'
	}

	share(){
		const shareData = this.form.value
		
		const formdata = new FormData()
		formdata.set("title", this.form.get('title').value)
		formdata.set("comments", this.form.get('comments').value)
		formdata.set("image-file", this.cameraSvc.getImage().imageData)//blob
		formdata.set("user_id", this.authenSvc.credentials.user_id)
		formdata.set("password", this.authenSvc.credentials.password)

		this.shareSvc.shareToBackend(formdata)
			.then( //if share is successful
				result => {
					console.info("share successful")
					this.clear()
				}
				
			).catch(err =>{
				//console.error("share failed: ", err.status)
				if (err.status == '401') this.router.navigate(['/'])
				else console.error(err)
			})
	}
}
