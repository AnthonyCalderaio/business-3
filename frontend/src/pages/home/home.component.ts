import { Component, OnInit } from '@angular/core';
import { environment } from '../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { Observable, of, switchMap } from 'rxjs';
import { PaymentsComponent } from '../payments/payments.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule, PaymentsComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit {
  title = 'frontend';
  inputText: string = '';
  keywords: any[] = [];
  isLoading: boolean = false;
  errorMessage: string = '';
  apiUrl = environment.backendUrl; 
  user: any;
  token: any;

  constructor(private http: HttpClient, private authService: AuthService) {}
  ngOnInit(): void {
    this.authService.isAuthenticated()
      .pipe(
        switchMap((isAuthenticated: boolean) => {
          if (isAuthenticated) {
            return this.authService.getUser(); 
          } else {
            return of(null);
          }
        }),
        switchMap((user: any) => {
          if (user) {
            this.user = user;
            return this.authService.getToken();
          } else {
            return of(null);
          }
        }),
        switchMap((token: any) => {
          if (token && this.user) {
            this.token = token; 
            return this.getUserMetadata(token);
          } else {
            return of(null);
          }
        })
      )
      .subscribe((metadata: any) => {
        if (metadata) {
          // Merge metadata into the user object
          this.user = { ...this.user, ...metadata };
        }
      });
  }

  extractKeywords(): void {
    if (!this.inputText.trim()) {
      this.errorMessage = 'Please enter some text.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    this.http.post<any>(`${this.apiUrl}`+'/extract-keywords', { text: this.inputText })
      .subscribe({
        next: (response) => {
          this.keywords = response.keywords;
          this.isLoading = false;
        },
        error: (error) => {
          this.errorMessage = 'Error extracting keywords.';
          this.isLoading = false;
        }
      });
  }

  getUserMetadata(token: string): Observable<any> {
    return this.http.post(`${this.apiUrl}`+'/api/user-metadata', { token }); // Send user token to the server
  }

  logout(){
    this.authService.logout();
  }

  purchasePremium(){

  }
}
