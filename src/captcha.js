import axios from 'axios';
import { logger } from '../utils/logger.js';

export class CaptchaManager {
  constructor() {
    this.apiKey = process.env.ANTICAPTCHA_API_KEY || process.env.CAPTCHA_API_KEY;
    this.baseUrl = 'https://api.anti-captcha.com';
    this.maxRetries = 3;
    this.pollInterval = 5000; // 5 seconds
    this.maxWaitTime = 120000; // 2 minutes
  }

  async solveImageCaptcha(page, captchaElement) {
    if (!this.apiKey) {
      logger.warn('No captcha API key provided, skipping captcha solving');
      return null;
    }

    try {
      logger.info('Solving image captcha...');
      
      // Take screenshot of captcha
      const captchaImage = await captchaElement.screenshot({ type: 'png' });
      const base64Image = captchaImage.toString('base64');
      
      // Submit to Anti-Captcha
      const taskId = await this.submitImageTask(base64Image);
      if (!taskId) {
        throw new Error('Failed to submit captcha task');
      }
      
      // Poll for result
      const solution = await this.pollForResult(taskId);
      
      if (solution) {
        logger.info('Captcha solved successfully');
        return solution;
      } else {
        logger.error('Failed to solve captcha');
        return null;
      }
      
    } catch (error) {
      logger.error('Error solving image captcha:', error);
      return null;
    }
  }

  async solveRecaptcha(page) {
    if (!this.apiKey) {
      logger.warn('No captcha API key provided, skipping reCAPTCHA solving');
      return false;
    }

    try {
      logger.info('Solving reCAPTCHA...');
      
      // Get site key
      const siteKey = await page.evaluate(() => {
        const recaptchaElement = document.querySelector('.g-recaptcha');
        return recaptchaElement ? recaptchaElement.getAttribute('data-sitekey') : null;
      });
      
      if (!siteKey) {
        logger.error('Could not find reCAPTCHA site key');
        return false;
      }
      
      const currentUrl = page.url();
      
      // Submit reCAPTCHA task
      const taskId = await this.submitRecaptchaTask(siteKey, currentUrl);
      if (!taskId) {
        throw new Error('Failed to submit reCAPTCHA task');
      }
      
      // Poll for result
      const solution = await this.pollForResult(taskId);
      
      if (solution) {
        // Inject solution into page
        await page.evaluate((token) => {
          const textarea = document.querySelector('#g-recaptcha-response');
          if (textarea) {
            textarea.value = token;
            textarea.style.display = 'block';
          }
          
          // Trigger callback if exists
          if (window.grecaptcha && window.grecaptcha.getResponse) {
            const callback = window.grecaptcha.getResponse();
            if (callback) {
              callback(token);
            }
          }
        }, solution);
        
        logger.info('reCAPTCHA solved and injected');
        return true;
      } else {
        logger.error('Failed to solve reCAPTCHA');
        return false;
      }
      
    } catch (error) {
      logger.error('Error solving reCAPTCHA:', error);
      return false;
    }
  }

  async submitImageTask(base64Image) {
    try {
      const response = await axios.post(`${this.baseUrl}/createTask`, {
        clientKey: this.apiKey,
        task: {
          type: 'ImageToTextTask',
          body: base64Image,
          phrase: false,
          case: false,
          numeric: 0,
          math: false,
          minLength: 4,
          maxLength: 8
        }
      });
      
      if (response.data.errorId === 0) {
        logger.info(`Captcha task submitted with ID: ${response.data.taskId}`);
        return response.data.taskId;
      } else {
        logger.error('Failed to submit captcha task:', response.data.errorDescription);
        return null;
      }
      
    } catch (error) {
      logger.error('Error submitting image captcha task:', error);
      return null;
    }
  }

  async submitRecaptchaTask(siteKey, pageUrl) {
    try {
      const response = await axios.post(`${this.baseUrl}/createTask`, {
        clientKey: this.apiKey,
        task: {
          type: 'NoCaptchaTaskProxyless',
          websiteURL: pageUrl,
          websiteKey: siteKey,
          isInvisible: false
        }
      });
      
      if (response.data.errorId === 0) {
        logger.info(`reCAPTCHA task submitted with ID: ${response.data.taskId}`);
        return response.data.taskId;
      } else {
        logger.error('Failed to submit reCAPTCHA task:', response.data.errorDescription);
        return null;
      }
      
    } catch (error) {
      logger.error('Error submitting reCAPTCHA task:', error);
      return null;
    }
  }

  async pollForResult(taskId) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < this.maxWaitTime) {
      try {
        const response = await axios.post(`${this.baseUrl}/getTaskResult`, {
          clientKey: this.apiKey,
          taskId: taskId
        });
        
        if (response.data.errorId === 0) {
          if (response.data.status === 'ready') {
            const solution = response.data.solution.text || response.data.solution.gRecaptchaResponse;
            logger.info('Captcha solution received');
            return solution;
          } else if (response.data.status === 'processing') {
            logger.debug('Captcha still processing...');
            await new Promise(resolve => setTimeout(resolve, this.pollInterval));
            continue;
          } else {
            logger.error('Unexpected captcha status:', response.data.status);
            return null;
          }
        } else {
          logger.error('Error getting captcha result:', response.data.errorDescription);
          return null;
        }
        
      } catch (error) {
        logger.error('Error polling for captcha result:', error);
        await new Promise(resolve => setTimeout(resolve, this.pollInterval));
      }
    }
    
    logger.error('Captcha solving timeout');
    return null;
  }

  async getBalance() {
    if (!this.apiKey) {
      return null;
    }

    try {
      const response = await axios.post(`${this.baseUrl}/getBalance`, {
        clientKey: this.apiKey
      });
      
      if (response.data.errorId === 0) {
        return response.data.balance;
      } else {
        logger.error('Error getting balance:', response.data.errorDescription);
        return null;
      }
      
    } catch (error) {
      logger.error('Error checking captcha service balance:', error);
      return null;
    }
  }

  // Alternative: 2Captcha service
  async solve2Captcha(base64Image) {
    if (!this.apiKey) {
      logger.warn('No 2Captcha API key provided');
      return null;
    }

    try {
      // Submit captcha
      const submitResponse = await axios.post('http://2captcha.com/in.php', null, {
        params: {
          key: this.apiKey,
          method: 'base64',
          body: base64Image,
          json: 1
        }
      });
      
      if (submitResponse.data.status !== 1) {
        logger.error('2Captcha submit error:', submitResponse.data.error_text);
        return null;
      }
      
      const captchaId = submitResponse.data.request;
      logger.info(`2Captcha task submitted with ID: ${captchaId}`);
      
      // Poll for result
      const startTime = Date.now();
      while (Date.now() - startTime < this.maxWaitTime) {
        await new Promise(resolve => setTimeout(resolve, this.pollInterval));
        
        const resultResponse = await axios.get('http://2captcha.com/res.php', {
          params: {
            key: this.apiKey,
            action: 'get',
            id: captchaId,
            json: 1
          }
        });
        
        if (resultResponse.data.status === 1) {
          logger.info('2Captcha solution received');
          return resultResponse.data.request;
        } else if (resultResponse.data.error_text !== 'CAPCHA_NOT_READY') {
          logger.error('2Captcha error:', resultResponse.data.error_text);
          return null;
        }
      }
      
      logger.error('2Captcha timeout');
      return null;
      
    } catch (error) {
      logger.error('Error with 2Captcha service:', error);
      return null;
    }
  }
}