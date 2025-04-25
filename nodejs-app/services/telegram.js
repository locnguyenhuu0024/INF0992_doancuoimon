const TelegramBot = require('node-telegram-bot-api');
const dotenv = require('dotenv');
const db = require('./db');

// Load environment variables
dotenv.config();

// Telegram configuration
const botToken = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;
const gasThreshold = parseInt(process.env.GAS_THRESHOLD || '600', 10);
const tempThreshold = parseInt(process.env.TEMP_THRESHOLD || '45', 10);
const reportInterval = parseInt(process.env.TELEGRAM_REPORT_INTERVAL || '300000', 10); // 5 minutes in milliseconds

// Create a bot instance
let bot = null;

// Variables to manage status and alerts
let isGasAlertActive = false;
let isTempAlertActive = false;
let isExplosionRiskAlertActive = false;
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
    const result = await sendMessage('🤖 Hệ thống giám sát khí gas đang hoạt động.', false, true);
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
  
  const isGasLevelHigh = data.gas_volume > gasThreshold;
  const isTempHigh = data.temperature > tempThreshold;
  const isExplosionRisk = isGasLevelHigh && isTempHigh;
  
  // Handle explosion risk (highest priority)
  if (isExplosionRisk) {
    if (!isExplosionRiskAlertActive) {
      isExplosionRiskAlertActive = true;
      await sendExplosionRiskAlert(data);
    }
    // Reset other alert flags since explosion risk takes precedence
    isGasAlertActive = true;
    isTempAlertActive = true;
  } else {
    // If explosion risk resolved, send recovery message
    if (isExplosionRiskAlertActive) {
      isExplosionRiskAlertActive = false;
      await sendRiskNormalizedAlert(data, 'explosion risk');
    }
    
    // Handle gas alert
    if (isGasLevelHigh) {
      if (!isGasAlertActive) {
        isGasAlertActive = true;
        await sendGasAlert(data);
      }
    } else if (isGasAlertActive) {
      isGasAlertActive = false;
      await sendRiskNormalizedAlert(data, 'gas');
    }
    
    // Handle temperature alert
    if (isTempHigh) {
      if (!isTempAlertActive) {
        isTempAlertActive = true;
        await sendHighTemperatureAlert(data);
      }
    } else if (isTempAlertActive) {
      isTempAlertActive = false;
      await sendRiskNormalizedAlert(data, 'temperature');
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
 * Send a gas leak alert
 * @param {Object} data - The sensor data
 */
async function sendGasAlert(data) {
  const message = `⚠️ PHÁT HIỆN RÒ RỈ KHÍ GAS ⚠️

Nồng độ gas: <b>${data.gas_volume}</b>
Nhiệt độ: ${data.temperature}°C
Độ ẩm: ${data.humidity}%
Vị trí: ${data.type}
Thời gian: ${new Date().toLocaleString()}

Vui lòng kiểm tra nguồn gas và đảm bảo thông gió!`;

  await sendMessage(message, true);
}

/**
 * Send a high temperature alert
 * @param {Object} data - The sensor data
 */
async function sendHighTemperatureAlert(data) {
  const message = `🔥 CẢNH BÁO NHIỆT ĐỘ CAO 🔥

Nhiệt độ: <b>${data.temperature}°C</b>
Nồng độ gas: ${data.gas_volume}
Độ ẩm: ${data.humidity}%
Vị trí: ${data.type}
Thời gian: ${new Date().toLocaleString()}

Vui lòng kiểm tra nguồn nhiệt và đảm bảo làm mát!`;

  await sendMessage(message, true);
}

/**
 * Send an explosion risk alert when both gas and temperature are high
 * @param {Object} data - The sensor data
 */
async function sendExplosionRiskAlert(data) {
  const message = `🚨 KHẨN CẤP: NGUY CƠ CHÁY NỔ 🚨

PHÁT HIỆN ĐIỀU KIỆN NGUY HIỂM:
- Nồng độ gas: <b>${data.gas_volume}</b>
- Nhiệt độ: <b>${data.temperature}°C</b>
Độ ẩm: ${data.humidity}%
Vị trí: ${data.type}
Thời gian: ${new Date().toLocaleString()}

YÊU CẦU HÀNH ĐỘNG NGAY LẬP TỨC:
- Sơ tán khỏi khu vực
- Ngắt nguồn điện nếu có thể
- Không sử dụng lửa hoặc công tắc điện
- Đảm bảo thông gió`;

  await sendMessage(message, true);
}

/**
 * Send an alert when risk conditions return to normal
 * @param {Object} data - The sensor data
 * @param {string} riskType - The type of risk that was normalized
 */
async function sendRiskNormalizedAlert(data, riskType) {
  let riskTypeVietnamese = '';
  
  switch(riskType) {
    case 'gas':
      riskTypeVietnamese = 'KHÍ GAS';
      break;
    case 'temperature':
      riskTypeVietnamese = 'NHIỆT ĐỘ';
      break;
    case 'explosion risk':
      riskTypeVietnamese = 'NGUY CƠ CHÁY NỔ';
      break;
    default:
      riskTypeVietnamese = riskType.toUpperCase();
  }
  
  const message = `✅ ${riskTypeVietnamese} đã trở về mức bình thường

Nồng độ gas: ${data.gas_volume}
Nhiệt độ: ${data.temperature}°C
Độ ẩm: ${data.humidity}%
Vị trí: ${data.type}
Thời gian: ${new Date().toLocaleString()}`;

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
      ? '🚨 NGUY HIỂM' 
      : (lastDataPoint.gas_volume > gasThreshold ? '⚠️ CẢNH BÁO' : '✅ BÌNH THƯỜNG');
    
    const tempStatus = lastDataPoint.temperature > tempThreshold
      ? '🔥 CAO'
      : (lastDataPoint.temperature > tempThreshold * 0.9 ? '⚠️ CẢNH BÁO' : '✅ BÌNH THƯỜNG');
    
    const message = `📊 Báo Cáo Trạng Thái Định Kỳ

Nồng độ Gas: <b>${lastDataPoint.gas_volume}</b> - ${gasStatus}
Nhiệt độ: <b>${lastDataPoint.temperature}°C</b> - ${tempStatus}
Độ ẩm: ${lastDataPoint.humidity}%
Vị trí: ${lastDataPoint.type}
Trạng thái cảm biến: Hoạt động
Cập nhật lần cuối: ${new Date(lastDataPoint.created_at).toLocaleString()}`;

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
  sendGasAlert,
  sendHighTemperatureAlert,
  sendExplosionRiskAlert,
  sendRegularReport
}; 