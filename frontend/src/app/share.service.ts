import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";

@Injectable()
export class ShareService{
    constructor(private http: HttpClient){}

    async shareToBackend(formdata: FormData): Promise<any>{
        return await this.http.post<any>('/sharecontent', formdata).toPromise()
    }
}