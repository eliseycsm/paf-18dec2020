import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { LoginData } from "./models";

@Injectable()
export class AuthenSvc{

    constructor(private http:HttpClient){}


    async verifyLogin(data: LoginData): Promise<any>{
        return await this.http.post<any>('/checklogin', data).toPromise()
        
    }
}