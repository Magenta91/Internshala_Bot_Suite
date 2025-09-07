import { logger } from '../utils/logger.js';

export class StealthManager {
  constructor() {
    this.userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15'
    ];
    
    this.viewports = [
      { width: 1366, height: 768 },
      { width: 1920, height: 1080 },
      { width: 1440, height: 900 },
      { width: 1536, height: 864 },
      { width: 1280, height: 720 }
    ];
    
    this.timezones = [
      'America/New_York',
      'America/Los_Angeles',
      'Europe/London',
      'Europe/Berlin',
      'Asia/Tokyo',
      'Asia/Shanghai',
      'Asia/Kolkata'
    ];
    
    this.languages = [
      'en-US,en;q=0.9',
      'en-GB,en;q=0.9',
      'en-US,en;q=0.9,es;q=0.8',
      'en-US,en;q=0.9,fr;q=0.8',
      'en-US,en;q=0.9,de;q=0.8'
    ];
  }

  async getContextOptions() {
    const userAgent = this.getRandomUserAgent();
    const viewport = this.getRandomViewport();
    const timezone = this.getRandomTimezone();
    const language = this.getRandomLanguage();
    
    logger.info(`Using User Agent: ${userAgent.substring(0, 50)}...`);
    logger.info(`Using Viewport: ${viewport.width}x${viewport.height}`);
    
    return {
      userAgent,
      viewport,
      timezoneId: timezone,
      locale: language.split(',')[0],
      extraHTTPHeaders: {
        'Accept-Language': language,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept-Charset': 'utf-8, iso-8859-1;q=0.5',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1'
      },
      permissions: ['geolocation', 'notifications'],
      colorScheme: 'light',
      reducedMotion: 'no-preference',
      forcedColors: 'none'
    };
  }

  async applyStealthPatches(context) {
    logger.info('Applying stealth patches...');
    
    // Add stealth scripts to all pages
    await context.addInitScript(() => {
      // Remove webdriver property
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
      
      // Mock plugins
      Object.defineProperty(navigator, 'plugins', {
        get: () => [
          {
            0: {
              type: "application/x-google-chrome-pdf",
              suffixes: "pdf",
              description: "Portable Document Format",
              enabledPlugin: Plugin
            },
            description: "Portable Document Format",
            filename: "internal-pdf-viewer",
            length: 1,
            name: "Chrome PDF Plugin"
          },
          {
            0: {
              type: "application/pdf",
              suffixes: "pdf",
              description: "",
              enabledPlugin: Plugin
            },
            description: "",
            filename: "mhjfbmdgcfjbbpaeojofohoefgiehjai",
            length: 1,
            name: "Chrome PDF Viewer"
          }
        ],
      });
      
      // Mock languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });
      
      // Mock permissions
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission }) :
          originalQuery(parameters)
      );
      
      // Mock chrome runtime
      if (!window.chrome) {
        window.chrome = {};
      }
      
      if (!window.chrome.runtime) {
        window.chrome.runtime = {
          onConnect: {
            addListener: () => {},
            removeListener: () => {},
          },
          onMessage: {
            addListener: () => {},
            removeListener: () => {},
          },
        };
      }
      
      // Mock screen properties
      Object.defineProperty(screen, 'availTop', { get: () => 0 });
      Object.defineProperty(screen, 'availLeft', { get: () => 0 });
      Object.defineProperty(screen, 'availWidth', { get: () => screen.width });
      Object.defineProperty(screen, 'availHeight', { get: () => screen.height - 40 });
      
      // Mock battery API
      if ('getBattery' in navigator) {
        const originalGetBattery = navigator.getBattery;
        navigator.getBattery = () => originalGetBattery().then(battery => ({
          ...battery,
          charging: true,
          chargingTime: 0,
          dischargingTime: Infinity,
          level: Math.random() * 0.5 + 0.5
        }));
      }
      
      // Mock connection
      if ('connection' in navigator) {
        Object.defineProperty(navigator.connection, 'rtt', { get: () => 100 });
        Object.defineProperty(navigator.connection, 'downlink', { get: () => 10 });
      }
      
      // Override toString methods
      const toStringProxy = (obj, name) => {
        const handler = {
          apply: function(target, thisArg, argumentsList) {
            return `function ${name}() { [native code] }`;
          }
        };
        return new Proxy(obj.toString, handler);
      };
      
      navigator.getBattery.toString = toStringProxy(navigator.getBattery, 'getBattery');
      navigator.permissions.query.toString = toStringProxy(navigator.permissions.query, 'query');
    });
    
    // Set additional context options
    await context.route('**/*', (route) => {
      const headers = route.request().headers();
      
      // Add realistic headers
      headers['sec-ch-ua'] = '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"';
      headers['sec-ch-ua-mobile'] = '?0';
      headers['sec-ch-ua-platform'] = '"Windows"';
      
      route.continue({ headers });
    });
  }

  getRandomUserAgent() {
    return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
  }

  getRandomViewport() {
    const baseViewport = this.viewports[Math.floor(Math.random() * this.viewports.length)];
    
    // Add small random variations
    return {
      width: baseViewport.width + Math.floor(Math.random() * 100) - 50,
      height: baseViewport.height + Math.floor(Math.random() * 100) - 50
    };
  }

  getRandomTimezone() {
    return this.timezones[Math.floor(Math.random() * this.timezones.length)];
  }

  getRandomLanguage() {
    return this.languages[Math.floor(Math.random() * this.languages.length)];
  }

  async randomDelay(min = 100, max = 300) {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  async humanType(page, element, text) {
    logger.debug(`Typing text: "${text.substring(0, 20)}..."`);
    
    // Focus the element
    await element.focus();
    await this.randomDelay(100, 300);
    
    // Type with human-like delays
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      
      // Random typing speed
      const typingDelay = Math.floor(Math.random() * 150) + 50;
      
      // Occasionally make "mistakes" and correct them
      if (Math.random() < 0.02 && i > 0) {
        await page.keyboard.press('Backspace');
        await this.randomDelay(100, 200);
      }
      
      await page.keyboard.type(char);
      await this.randomDelay(typingDelay, typingDelay + 50);
      
      // Occasional longer pauses (thinking)
      if (Math.random() < 0.1) {
        await this.randomDelay(300, 800);
      }
    }
  }

  async humanClick(page, element) {
    logger.debug('Performing human-like click');
    
    // Get element bounding box
    const box = await element.boundingBox();
    if (!box) {
      throw new Error('Element not visible for clicking');
    }
    
    // Calculate random click position within element
    const x = box.x + Math.random() * box.width;
    const y = box.y + Math.random() * box.height;
    
    // Move mouse to element with slight curve
    await this.humanMouseMove(page, x, y);
    
    // Random delay before click
    await this.randomDelay(50, 150);
    
    // Click with slight randomization
    await page.mouse.click(x + (Math.random() - 0.5) * 2, y + (Math.random() - 0.5) * 2);
    
    // Small delay after click
    await this.randomDelay(100, 200);
  }

  async humanMouseMove(page, targetX, targetY) {
    const currentPosition = await page.evaluate(() => ({
      x: window.mouseX || 0,
      y: window.mouseY || 0
    }));
    
    const steps = Math.floor(Math.random() * 10) + 5;
    const deltaX = (targetX - currentPosition.x) / steps;
    const deltaY = (targetY - currentPosition.y) / steps;
    
    for (let i = 0; i < steps; i++) {
      const x = currentPosition.x + deltaX * i + (Math.random() - 0.5) * 2;
      const y = currentPosition.y + deltaY * i + (Math.random() - 0.5) * 2;
      
      await page.mouse.move(x, y);
      await this.randomDelay(10, 30);
    }
    
    // Final move to exact position
    await page.mouse.move(targetX, targetY);
    
    // Store current mouse position
    await page.evaluate(({ x, y }) => {
      window.mouseX = x;
      window.mouseY = y;
    }, { x: targetX, y: targetY });
  }

  async humanScroll(page, direction = 'down', distance = 300) {
    logger.debug(`Scrolling ${direction} by ${distance}px`);
    
    const scrollSteps = Math.floor(distance / 50);
    const stepDistance = distance / scrollSteps;
    
    for (let i = 0; i < scrollSteps; i++) {
      const delta = direction === 'down' ? stepDistance : -stepDistance;
      
      await page.mouse.wheel(0, delta);
      await this.randomDelay(50, 100);
    }
    
    await this.randomDelay(200, 500);
  }

  async waitForStableNetwork(page, timeout = 5000) {
    logger.debug('Waiting for network to stabilize...');
    
    let requestCount = 0;
    const startTime = Date.now();
    
    const requestHandler = () => requestCount++;
    page.on('request', requestHandler);
    
    while (Date.now() - startTime < timeout) {
      const initialCount = requestCount;
      await this.randomDelay(1000, 1000);
      
      if (requestCount === initialCount) {
        // No new requests in the last second
        break;
      }
    }
    
    page.off('request', requestHandler);
    logger.debug('Network stabilized');
  }
}