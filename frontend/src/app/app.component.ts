import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterOutlet } from '@angular/router';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'frontend';
  inputText: string = '';
  keywords: any[] = [];
  isLoading: boolean = false;
  errorMessage: string = '';
  apiUrl = environment.backendUrl; 

  constructor(private http: HttpClient) {}

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
}

