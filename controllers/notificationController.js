

/**
 * Process Notification Controller
 *
 * Handles incoming notification requests forwarded by the Adapter Layer (Group 2).
 * The Adapter Layer is the ONLY external actor that directly calls this endpoint,
 * routing requests from various microservices (Appointment System, Queue System, etc.)
 * on their behalf.
 *
 * Implements duplicate detection, email sending, and database logging.
 *
 * Request body format (forwarded by Adapter Layer):
 * {
 *   "senderSystem": "string" (optional - original sender's name, e.g., "Appointment System"),
 *   "recipientEmail": "string",
 *   "subject": "string",
 *   "message": "string"
 * }
 *
 * If senderSystem is not provided, it will be auto-detected from the JWT token's role.
 */

import NotificationLog from '../models/NotificationLog.js';
import { sendEmail } from '../config/mailer.js';

const isValidEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

export const processNotification = async (req, res) => {
  try {
    const {
      senderSystem: providedSenderSystem,
      recipientEmail,
      subject,
      message
    } = req.body;

    if (!recipientEmail || !subject || !message) {
      return res.status(400).json({
        code: 'MISSING_FIELDS',
        message: 'Recipient email, subject, and message are required.'
      });
    }

    if (!isValidEmail(recipientEmail)) {
      return res.status(400).json({
        code: 'INVALID_EMAIL',
        message: 'Invalid email format for recipientEmail.'
      });
    }

    let senderSystem = 'Unknown System';

    if (providedSenderSystem) {
      senderSystem = providedSenderSystem;
    } else if (req.user?.role) {
      const role = req.user.role.toLowerCase();

      if (role === 'doctor') senderSystem = 'Doctor Portal';
      else if (role === 'patient') senderSystem = 'Patient Portal';
      else if (role === 'admin') senderSystem = 'Admin System';
      else senderSystem = `${req.user.role} System`;
    }

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const duplicateExists = await NotificationLog.findOne({
      recipientEmail,
      message,
      status: { $in: ['Sent', 'Duplicate'] },
      createdAt: { $gte: fiveMinutesAgo }
    });

    if (duplicateExists) {
      const dupLog = await NotificationLog.create({
        senderSystem,
        recipientEmail,
        subject,
        message,
        status: 'Duplicate',
        emailSent: false,
        errorMessage: 'Duplicate notification detected within 5 minutes.',
        senderEmail: req.user?.email || null
      });

      return res.status(409).json({
        code: 'DUPLICATE_NOTIFICATION',
        message: 'A similar notification already exists.',
        logId: dupLog._id
      });
    }

    let emailSent = false;
    let sendEmailError = null;

    try {
      await sendEmail(recipientEmail, subject, message);
      emailSent = true;
    } catch (error) {
      sendEmailError = error.message;
    }

    const savedLog = await NotificationLog.create({
      senderSystem,
      recipientEmail,
      subject,
      message,
      status: emailSent ? 'Sent' : 'Failed',
      emailSent,
      sendEmailError,
      senderEmail: req.user?.email || null
    });

    return res.status(emailSent ? 200 : 500).json({
      code: emailSent ? 'NOTIFICATION_SENT' : 'EMAIL_SEND_FAILED',
      message: emailSent
        ? 'Notification successfully processed and sent.'
        : 'Notification failed to send.',
      logId: savedLog._id,
      senderSystem: savedLog.senderSystem,
      recipientEmail: savedLog.recipientEmail,
      sentAt: savedLog.createdAt
    });

  } catch (error) {
    const errorLog = await NotificationLog.create({
      senderSystem:
        req.body?.senderSystem ||
        (req.user?.role ? `${req.user.role} System` : 'Unknown System'),
      recipientEmail: req.body?.recipientEmail || 'unknown_recipient',
      subject: req.body?.subject || 'unknown_subject',
      message: req.body?.message || 'unknown_message',
      status: 'Failed',
      emailSent: false,
      errorMessage: error.message,
      senderEmail: req.user?.email || null
    });

    return res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Unexpected server error.',
      logId: errorLog._id,
      error: error.message
    });
  }
};

export const getNotificationLogs = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, recipientEmail } = req.query;

    const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
    const parsedLimit = Math.max(parseInt(limit, 10) || 10, 1);

    const skip = (parsedPage - 1) * parsedLimit;

    let query = {};

    if (!req.user || !req.user.role) {
      query.recipientEmail = 'unauthorized_access';
    } else {
      const role = req.user.role.toLowerCase();

      if (role === 'patient') {
        query.recipientEmail = req.user.email;
      }

      if (role === 'doctor') {
        query.senderEmail = req.user.email;
      }

      if (role === 'admin' && recipientEmail) {
        query.recipientEmail = recipientEmail;
      }
    }

    if (status) {
      query.status = status;
    }

    const logs = await NotificationLog.find(query)
      .sort({ createdAt: -1 })
      .limit(parsedLimit)
      .skip(skip);

    const totalCount = await NotificationLog.countDocuments(query);

    return res.status(200).json({
      data: logs,
      currentPage: parsedPage,
      totalPages: Math.ceil(totalCount / parsedLimit),
      totalCount
    });

  } catch (error) {
    return res.status(500).json({
      code: 'FETCH_LOGS_ERROR',
      message: 'Failed to fetch notification logs',
      error: error.message
    });
  }
};




