const http = require('http');
const https = require('https');
const { URL } = require('url');

class VibeCore {
  constructor({ apiKey, baseUrl = 'https://api.vibecore.io' }) {
    if (!apiKey) {
      throw new Error('VibeCore SDK: API key (apiKey) is required');
    }
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;

    this.chat = {
      completions: {
        create: this._createChatCompletion.bind(this)
      }
    };
  }

  _createChatCompletion(params) {
    const { model, messages, max_tokens, temperature, ...rest } = params;

    if (!messages || !Array.isArray(messages)) {
      return Promise.reject(new Error('VibeCore SDK: messages array is required'));
    }

    return new Promise((resolve, reject) => {
      try {
        const url = new URL(this.baseUrl);
        const lib = url.protocol === 'https:' ? https : http;

        // Resolve clean request path
        let requestPath = url.pathname.replace(/\/$/, '');
        if (!requestPath.endsWith('/completions')) {
          if (requestPath.endsWith('/api/chat')) {
            requestPath += '/completions';
          } else {
            requestPath += '/api/chat/completions';
          }
        }

        const payload = JSON.stringify({
          model: model || 'auto',
          messages,
          max_tokens,
          temperature,
          ...rest
        });

        const options = {
          hostname: url.hostname,
          port: url.port || (url.protocol === 'https:' ? 443 : 80),
          path: requestPath,
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
          }
        };

        const req = lib.request(options, (res) => {
          let rawData = '';
          res.setEncoding('utf8');
          res.on('data', (chunk) => {
            rawData += chunk;
          });
          res.on('end', () => {
            let parsedData = {};
            try {
              if (rawData) {
                parsedData = JSON.parse(rawData);
              }
            } catch (err) {
              return reject(new Error(`VibeCore SDK JSON Parse Error: ${err.message}. Raw: ${rawData}`));
            }

            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(parsedData);
            } else {
              reject(new Error(`VibeCore API Error [${res.statusCode}]: ${parsedData.error || rawData}`));
            }
          });
        });

        req.on('error', (err) => {
          reject(new Error(`VibeCore SDK Network Error: ${err.message}`));
        });

        // Set timeout
        req.setTimeout(65000, () => {
          req.destroy(new Error('VibeCore SDK: Gateway request timed out (65s limit)'));
        });

        req.write(payload);
        req.end();
      } catch (err) {
        reject(err);
      }
    });
  }
}

module.exports = VibeCore;
