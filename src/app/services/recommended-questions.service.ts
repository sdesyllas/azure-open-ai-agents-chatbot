import { Injectable } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ApiConfig } from '../config/api-config';

@Injectable({
  providedIn: 'root'
})
export class RecommendedQuestionsService {
  private readonly apiEndpoint = ApiConfig.openai.apiEndpoint;
  private readonly apiVersion = ApiConfig.openai.apiVersion;
  private readonly apiKey = ApiConfig.openai.apiKey;

  constructor(private http: HttpClient) { }

  /**
   * Generate recommended follow-up questions based on previous messages
   * @param messages The conversation history to base recommendations on
   * @returns An Observable with an array of recommended questions
   */
  getRecommendedQuestions(messages: { role: string, content: string }[]): Observable<string[]> {
    console.log('Generating recommended questions based on conversation history:', 
      `${messages.length} messages`);
    
    // Ensure we have messages to generate recommendations from
    if (!messages.length) {
      console.log('No messages provided, returning empty recommendations array');
      return of([]);
    }

    const url = `${this.apiEndpoint}?api-version=${this.apiVersion}`;
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'api-key': this.apiKey
    });

    // Create a system prompt that guides the model to generate follow-up questions
    const systemPrompt = {
      role: 'system',
      content: 'You are an AI assistant helping to generate follow-up questions. ' +
        'Based on the conversation history, suggest 3 questions the user might want to ask next. ' + 
        'Make them concise, relevant, and diverse. Return them in JSON format as an array of strings, with no additional text.'
    };

    // Prepare the payload for the OpenAI API call
    const payload = {
      messages: [
        systemPrompt,
        ...messages,
        {
          role: 'user',
          content: 'Generate three follow-up question suggestions based on our conversation so far.'
        }
      ],
      max_tokens: 150,
      temperature: 0.7,
      response_format: { type: 'json_object' }
    };

    console.log('Making API request to fetch recommended questions');

    return this.http.post(url, payload, { headers }).pipe(
      map((response: any) => {
        console.log('Received response for recommended questions');
        try {
          // Parse the response to extract questions
          const content = response.choices[0].message.content;
          const parsedContent = JSON.parse(content);
          const questions = Array.isArray(parsedContent.questions) ? parsedContent.questions : [];
          
          // Return up to 3 questions
          const result = questions.slice(0, 3);
          console.log('Successfully extracted recommended questions:', result);
          return result;
        } catch (error) {
          console.error('Error parsing recommended questions:', error);
          return [];
        }
      }),
      catchError(error => {
        console.error('Error fetching recommended questions:', error);
        return of([]);
      })
    );
  }
}