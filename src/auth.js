import { logger } from '../utils/logger.js';

export class AuthManager {
  constructor() {
    this.maxRetries = 3;
    this.retryDelay = 2000;
  }

  async performLogin(page, stealth, captcha) {
    let attempt = 0;
    
    while (attempt < this.maxRetries) {
      try {
        attempt++;
        logger.info(`Login attempt ${attempt}/${this.maxRetries}`);
        
        // Navigate to login page
        await page.goto('https://internshala.com/login/student', { 
          waitUntil: 'networkidle' 
        });
        
        await stealth.randomDelay(1000, 2000);
        
        // Check if already logged in
        if (await this.isAlreadyLoggedIn(page)) {
          logger.info('Already logged in, redirecting to dashboard');
          return;
        }
        
        // Fill login form
        await this.fillLoginForm(page, stealth);
        
        // Handle captcha if present
        await this.handleCaptcha(page, captcha, stealth);
        
        // Submit form
        await this.submitLoginForm(page, stealth);
        
        // Wait for login result
        await this.waitForLoginResult(page);
        
        logger.info('Login successful');
        return;
        
      } catch (error) {
        logger.error(`Login attempt ${attempt} failed:`, error);
        
        if (attempt === this.maxRetries) {
          throw new Error(`Login failed after ${this.maxRetries} attempts: ${error.message}`);
        }
        
        // Exponential backoff
        const delay = this.retryDelay * Math.pow(2, attempt - 1);
        logger.info(`Retrying in ${delay}ms...`);
        await stealth.randomDelay(delay, delay + 1000);
      }
    }
  }

  async isAlreadyLoggedIn(page) {
    try {
      // Check for dashboard redirect or user elements
      await page.waitForTimeout(2000);
      const currentUrl = page.url();
      
      if (currentUrl.includes('dashboard') || currentUrl.includes('student/profile')) {
        return true;
      }
      
      // Check for user profile elements
      const userElements = await page.$$('.user-profile, .dashboard-container, .student-name');
      return userElements.length > 0;
      
    } catch {
      return false;
    }
  }

  async fillLoginForm(page, stealth) {
    logger.info('Filling login form...');
    
    // Wait for form elements
    await page.waitForSelector('#email, input[name="email"], input[type="email"]', { timeout: 10000 });
    
    const email = process.env.USER_EMAIL;
    const password = process.env.USER_PASSWORD;
    
    if (!email || !password) {
      throw new Error('USER_EMAIL and USER_PASSWORD must be set in .env file');
    }
    
    // Fill email
    const emailSelector = await page.$('#email') || await page.$('input[name="email"]') || await page.$('input[type="email"]');
    if (emailSelector) {
      await stealth.humanType(page, emailSelector, email);
      await stealth.randomDelay(500, 1000);
    }
    
    // Fill password
    const passwordSelector = await page.$('#password') || await page.$('input[name="password"]') || await page.$('input[type="password"]');
    if (passwordSelector) {
      await stealth.humanType(page, passwordSelector, password);
      await stealth.randomDelay(500, 1000);
    }
    
    logger.info('Login form filled');
  }

  async handleCaptcha(page, captcha, stealth) {
    try {
      // Check for various captcha types
      const captchaSelectors = [
        '.captcha-container',
        '.g-recaptcha',
        '.h-captcha',
        'iframe[src*="recaptcha"]',
        'iframe[src*="hcaptcha"]',
        '#captcha',
        '.captcha-image'
      ];
      
      let captchaElement = null;
      for (const selector of captchaSelectors) {
        captchaElement = await page.$(selector);
        if (captchaElement) {
          logger.info(`Found captcha: ${selector}`);
          break;
        }
      }
      
      if (!captchaElement) {
        logger.info('No captcha detected');
        return;
      }
      
      // Handle different captcha types
      if (await page.$('.g-recaptcha')) {
        await this.handleRecaptcha(page, captcha, stealth);
      } else if (await page.$('.captcha-image')) {
        await this.handleImageCaptcha(page, captcha, stealth);
      } else {
        logger.warn('Unknown captcha type detected');
      }
      
    } catch (error) {
      logger.error('Error handling captcha:', error);
      // Continue without captcha solving
    }
  }

  async handleRecaptcha(page, captcha, stealth) {
    logger.info('Handling reCAPTCHA...');
    
    try {
      // Wait for reCAPTCHA to load
      await page.waitForSelector('.g-recaptcha', { timeout: 5000 });
      await stealth.randomDelay(2000, 3000);
      
      // Click on reCAPTCHA checkbox
      const recaptchaFrame = await page.frameLocator('iframe[src*="recaptcha"]').first();
      await recaptchaFrame.locator('.recaptcha-checkbox-border').click();
      
      await stealth.randomDelay(3000, 5000);
      
      // Check if challenge appeared
      const challengeFrame = page.frameLocator('iframe[src*="recaptcha"][src*="bframe"]');
      const challengeVisible = await challengeFrame.locator('.rc-imageselect').isVisible().catch(() => false);
      
      if (challengeVisible) {
        logger.info('reCAPTCHA challenge detected, attempting to solve...');
        await captcha.solveRecaptcha(page);
      }
      
    } catch (error) {
      logger.error('Failed to handle reCAPTCHA:', error);
    }
  }

  async handleImageCaptcha(page, captcha, stealth) {
    logger.info('Handling image captcha...');
    
    try {
      const captchaImage = await page.$('.captcha-image, img[src*="captcha"]');
      if (captchaImage) {
        const solution = await captcha.solveImageCaptcha(page, captchaImage);
        
        if (solution) {
          const captchaInput = await page.$('#captcha, input[name="captcha"], .captcha-input');
          if (captchaInput) {
            await stealth.humanType(page, captchaInput, solution);
            logger.info('Captcha solution entered');
          }
        }
      }
    } catch (error) {
      logger.error('Failed to handle image captcha:', error);
    }
  }

  async submitLoginForm(page, stealth) {
    logger.info('Submitting login form...');
    
    // Find and click submit button
    const submitSelectors = [
      'button[type="submit"]',
      'input[type="submit"]',
      '.login-btn',
      '.submit-btn',
      '#login-btn',
      'button:has-text("Login")',
      'button:has-text("Sign In")'
    ];
    
    let submitButton = null;
    for (const selector of submitSelectors) {
      submitButton = await page.$(selector);
      if (submitButton) {
        break;
      }
    }
    
    if (!submitButton) {
      throw new Error('Could not find submit button');
    }
    
    await stealth.humanClick(page, submitButton);
    await stealth.randomDelay(1000, 2000);
  }

  async waitForLoginResult(page) {
    logger.info('Waiting for login result...');
    
    try {
      // Wait for either success (dashboard) or error
      await Promise.race([
        // Success indicators
        page.waitForURL('**/dashboard**', { timeout: 15000 }),
        page.waitForURL('**/student/profile**', { timeout: 15000 }),
        page.waitForSelector('.dashboard-container', { timeout: 15000 }),
        
        // Error indicators
        page.waitForSelector('.error-message, .alert-danger, .login-error', { timeout: 15000 })
          .then(() => { throw new Error('Login error detected'); })
      ]);
      
      // Additional verification
      await page.waitForTimeout(2000);
      const currentUrl = page.url();
      
      if (!currentUrl.includes('dashboard') && !currentUrl.includes('student')) {
        // Check for error messages
        const errorElement = await page.$('.error-message, .alert-danger, .login-error');
        if (errorElement) {
          const errorText = await errorElement.textContent();
          throw new Error(`Login failed: ${errorText}`);
        }
        
        throw new Error('Login may have failed - not redirected to dashboard');
      }
      
    } catch (error) {
      if (error.message.includes('Timeout')) {
        throw new Error('Login timeout - page did not redirect after form submission');
      }
      throw error;
    }
  }
}