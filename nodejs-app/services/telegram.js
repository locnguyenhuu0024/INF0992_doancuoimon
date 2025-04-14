const TelegramBot = require('node-telegram-bot-api');
const dotenv = require('dotenv');
const db = require('./db');

// Load environment variables
dotenv.config();

// Telegram configuration
const botToken = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;
const gasThreshold = parseInt(process.env.GAS_THRESHOLD || '600', 10);
const reportInterval = parseInt(process.env.TELEGRAM_REPORT_INTERVAL || '300000', 10); // 5 minutes in milliseconds

// Create a bot instance
let bot = null;

// Variables to manage status and alerts
let isAlertActive = false;
let lastReportTime = 0;
let lastDataPoint = null;
let messageFailCount = 0;

/**
 * Initialize the Telegram bot
 */
function initBot() {
  try {
    if (!botToken) {
      console.error('Telegram bot token missing. TELEGRAM_BOT_TOKEN is required.');
      return;
    }

    if (!chatId) {
      console.error('Telegram chat ID missing. TELEGRAM_CHAT_ID is required.');
      console.error('Please follow these steps to get a valid chat ID:');
      console.error('1. Send a message to your bot (@YourBotName)');
      console.error('2. Open https://api.telegram.org/bot' + botToken + '/getUpdates in your browser');
      console.error('3. Look for "chat":{"id":XXXXXXXX} in the response');
      console.error('4. Update the TELEGRAM_CHAT_ID value in your .env file');
      return;
    }

    bot = new TelegramBot(botToken, { polling: false });
    console.log('Telegram bot initialized with token:', botToken.substring(0, 6) + '...');
    console.log('Target chat ID:', chatId);

    // Validate chat ID by sending a test message
    validateChatId();
  } catch (error) {
    console.error('Failed to initialize Telegram bot:', error);
  }
}

/**
 * Validate the chat ID by sending a test message
 */
async function validateChatId() {
  try {
    const result = await sendMessage('🤖 Gas monitoring system is now online.', false, true);
    if (result) {
      console.log('Successfully sent test message to chat ID:', chatId);
    }
  } catch (error) {
    console.error('Failed to send test message:', error.message);
  }
}

/**
 * Send a message to the configured chat ID
 * @param {string} text - The message to send
 * @param {boolean} isUrgent - Whether this is an urgent message
 * @param {boolean} isTest - Whether this is a test message
 * @returns {Promise<Object>} The Telegram API response
 */
async function sendMessage(text, isUrgent = false, isTest = false) {
  if (!bot) {
    console.error('Cannot send Telegram message: Bot not initialized.');
    return;
  }

  if (!chatId) {
    console.error('Cannot send Telegram message: Chat ID not set.');
    return;
  }

  try {
    const prefix = isUrgent ? '🚨 EMERGENCY ALERT 🚨\n\n' : '';
    const message = `${prefix}${text}`;
    
    const result = await bot.sendMessage(chatId, message, {
      parse_mode: 'HTML',
      disable_notification: !isUrgent
    });
    
    console.log(`Telegram message sent: ${isUrgent ? 'URGENT' : 'INFO'}`);
    messageFailCount = 0; // Reset fail counter on success
    return result;
  } catch (error) {
    messageFailCount++;
    
    if (error.response && error.response.body) {
      const { error_code, description } = error.response.body;
      
      if (error_code === 400 && description.includes('chat not found')) {
        console.error(`Error: Telegram chat ID ${chatId} not found!`);
        console.error('Please ensure:');
        console.error('1. You have started a conversation with your bot');
        console.error('2. The chat ID is correct (should be a number like 123456789)');
        console.error('3. You are using a chat ID, not a username');
        console.error('4. Your bot has permission to send messages to this chat');
        
        // Log how to get the correct chat ID
        console.error('\nTo get your correct chat ID:');
        console.error('1. Send a message to your bot (@YourBotName)');
        console.error('2. Open https://api.telegram.org/bot' + botToken.substring(0, 6) + '...XXX/getUpdates in your browser');
        console.error('3. Look for "chat":{"id":XXXXXXXX} in the response');
      } else {
        console.error('Failed to send Telegram message:', error);
      }
    } else {
      console.error('Failed to send Telegram message:', error);
    }
    
    // If repeated failures, suggest debugging steps
    if (messageFailCount > 3 && !isTest) {
      console.error('Multiple message failures detected. Consider the following:');
      console.error('1. Check your internet connection');
      console.error('2. Verify both TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in .env');
      console.error('3. Make sure your bot is active (not blocked by user)');
      console.error('4. Try restarting the application after fixing issues');
    }
  }
}

/**
 * Process new sensor data and decide whether to send alerts
 * @param {Object} data - The sensor data
 */
async function processSensorData(data) {
  if (!data) return;
  
  lastDataPoint = data;
  
  // Check if gas level exceeds threshold
  if (data.gas_volume > gasThreshold) {
    // Only send a new alert if we don't have an active alert or if it's been more than 2 minutes
    if (!isAlertActive) {
      isAlertActive = true;
      await sendUrgentGasAlert(data);
    }
  } else {
    // If gas level is back to normal and we had an active alert, send recovery message
    if (isAlertActive) {
      isAlertActive = false;
      await sendGasNormalizedAlert(data);
    }
  }
  
  // Check if it's time for a regular report
  const currentTime = Date.now();
  if (currentTime - lastReportTime >= reportInterval) {
    await sendRegularReport();
    lastReportTime = currentTime;
  }
}

/**
 * Send an urgent alert when gas level exceeds threshold
 * @param {Object} data - The sensor data
 */
async function sendUrgentGasAlert(data) {
  const message = `Detected dangerous gas level: <b>${data.gas_volume}</b>
Temperature: ${data.temperature}°C
Humidity: ${data.humidity}%
Location: ${data.type}
Time: ${new Date().toLocaleString()}

Please take immediate action!`;

  await sendMessage(message, true);
}

/**
 * Send an alert when gas level returns to normal
 * @param {Object} data - The sensor data
 */
async function sendGasNormalizedAlert(data) {
  const message = `✅ Gas level has returned to normal: <b>${data.gas_volume}</b>
Temperature: ${data.temperature}°C
Humidity: ${data.humidity}%
Location: ${data.type}
Time: ${new Date().toLocaleString()}`;

  await sendMessage(message, false);
}

/**
 * Send a regular status report
 */
async function sendRegularReport() {
  try {
    // If we don't have recent data, fetch from the database
    if (!lastDataPoint) {
      const query = `
        SELECT * FROM sensor_data 
        ORDER BY created_at DESC 
        LIMIT 1
      `;
      
      const result = await db.query(query);
      if (result.rows.length > 0) {
        lastDataPoint = result.rows[0];
      } else {
        console.log('No data available for report');
        return;
      }
    }
    
    // Format the report message
    const gasStatus = lastDataPoint.gas_volume > gasThreshold 
      ? '🚨 DANGER' 
      : (lastDataPoint.gas_volume > gasThreshold * 0.7 ? '⚠️ WARNING' : '✅ NORMAL');
    
    const message = `📊 Regular Status Report

Gas Level: <b>${lastDataPoint.gas_volume}</b> - ${gasStatus}
Temperature: ${lastDataPoint.temperature}°C
Humidity: ${lastDataPoint.humidity}%
Location: ${lastDataPoint.type}
Sensor Status: Online
Last Update: ${new Date(lastDataPoint.created_at).toLocaleString()}`;

    await sendMessage(message, false);
    
  } catch (error) {
    console.error('Error sending regular report:', error);
  }
}

// Initialize the bot when the module is loaded
initBot();

module.exports = {
  sendMessage,
  processSensorData,
  sendUrgentGasAlert,
  sendRegularReport
}; 