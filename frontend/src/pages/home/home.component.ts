import { Component, OnInit } from '@angular/core';
import { environment } from '../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { map, Observable, of, switchMap } from 'rxjs';
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
  inputText: string = ''; // The text user inputs for keyword extraction
  keywords: any[] = [];   // Extracted keywords
  isLoading: boolean = false; // Flag to show loading state
  errorMessage: any = {};  // Error message to display if any issue occurs
  apiUrl = environment.backendUrl; // Backend API URL
  user: any;  // User data from Auth0
  token: any; // User authentication token
  usageLimitReached: boolean = false;  // Flag to track if the user has reached the usage limit
  devMode = true;

  constructor(private http: HttpClient, private authService: AuthService) {}

  ngOnInit(): void {
    this.authService.isAuthenticated()
      .pipe(
        switchMap((isAuthenticated: boolean) => {
          if (isAuthenticated) {
            return this.authService.getUser(); // Fetch the user data
          } else {
            return of(null);
          }
        }),
        switchMap((user: any) => {
          if (user) {
            this.user = user;
            return this.authService.getToken(); // Fetch the Auth0 token
          } else {
            return of(null);
          }
        }),
        switchMap((token: any) => {
          if (token && this.user) {
            this.token = token;
            return this.getUserMetadata(token, false); // Get the user metadata to check usage
          } else {
            return of(null);
          }
        })
      )
      .subscribe((metadata: any) => {
      });
  }



// Method to handle keyword extraction
extractKeywords(): void {
  // Validate input
  if (!this.inputText.trim()) {
    this.errorMessage = 'Please enter some text.';
    return;
  }

  // Check usage limit locally for non-premium users
  if (!this.user?.metadata?.isRegistered && this.usageLimitReached) {
    this.errorMessage = 'You have reached your free usage limit. Please upgrade to continue.';
    return;
  }

  // Set loading state
  this.isLoading = true;
  this.errorMessage = '';

  // Make the extraction API call
  this.http.post<any>(`${this.apiUrl}/extract-keywords`, {
    text: this.inputText,
    userId: this.user?.sub, // Include user ID for tracking
  })
    .pipe(
      switchMap((response) => {
        // Update extracted keywords
        this.keywords = response.keywords;

        // Handle usage tracking for free users
        if (!this.user?.metadata?.isRegistered && response.usageCount !== undefined) {
          this.usageLimitReached = response.usageCount >= this.user?.metadata?.usageLimit;
          if (this.usageLimitReached) {
            this.errorMessage = 'You have reached your free usage limit. Please upgrade to continue.';
          }
        }

        // Fetch updated user metadata
        return this.getUserMetadata(this.token, false);
      })
    )
    .subscribe({
      next: (metadataResponse) => {
        // Update local user metadata with refreshed data
        this.user.metadata = metadataResponse.app_metadata;

        // Clear loading state
        this.isLoading = false;
      },
      error: (error) => {
        // Handle errors
        this.errorMessage = error.error || 'Error extracting keywords.';
        this.isLoading = false;
      },
    });
} 
  

  // Method to get the user metadata, including usage limits from the server
  getUserMetadata(token: string, trackUsage = true): Observable<any> {
    return this.http.post(`${this.apiUrl}/api/user-metadata`, { token: token, trackUsage: trackUsage })
    .pipe(map((res: any) => {
      console.log('res:',res);
      const metadata = res?.app_metadata;
      if (metadata) {
        // Merge metadata (usage limits) into the user object
        this.user = { ...this.user, ...metadata };

        // Check if the user has reached their usage limit
        this.usageLimitReached = metadata?.usageLimitReached || false;
      }
      return metadata;
    })) // Send user token to the server
    /**
     * Res looks like:
     * {
        app_metadata: response.data.app_metadata,
        usageCount: usageCount, // Include updated usage count in the response
      }
     */
  }

  logout(): void {
    this.authService.logout(); // Handle user logout
  }

}
