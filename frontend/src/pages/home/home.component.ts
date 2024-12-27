import { Component } from '@angular/core';
import { environment } from '../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent {
  title = 'frontend';
  inputText: string = '';
  keywords: any[] = [];
  isLoading: boolean = false;
  errorMessage: string = '';
  apiUrl = environment.backendUrl; 

  constructor(private http: HttpClient, private authService: AuthService) {}

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

  logout(){
    this.authService.logout();
  }
}
