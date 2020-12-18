import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthenSvc } from '../app.authen';
import { LoginData } from '../models';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {

	errorMessage = ''
  form: FormGroup
  constructor(private fb: FormBuilder, private authensvc: AuthenSvc,
    private router: Router) { }

	ngOnInit(): void { 
    this.form  = this.fb.group({
      title: this.fb.control('', [Validators.required]),
      password: this.fb.control('', [Validators.required])
    })
  }

  async login(){
    const logindata = {
      user_id: this.form.get('title').value,
      password: this.form.get('password').value
    } as LoginData
    console.log("login data: ", logindata)
    this.authensvc.verifyLogin(logindata)
      .then(result => {
        console.log("username and pw is correct")
        this.router.navigate(['/main'])
      })
      .catch(e => {
        console.error("Authentication error")
        this.errorMessage = 'username or password is invalid; please try again'
      })
    

  }
}
