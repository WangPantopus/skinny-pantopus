const winston = require('winston');
const { redactLogMeta } = require('./redactLogMeta');

const redactFormat = winston.format((info) => {
  const { timestamp, level, message, stack, ...meta } = info;
  return Object.assign(info, redactLogMeta(meta));
});

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    redactFormat(),
    winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
      const metaString = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
      const stackString = stack ? `\n${stack}` : '';
      return `${timestamp} [${level}]: ${message}${metaString}${stackString}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({
      filename: 'combined.log',
      maxsize: 52428800,  // 50MB per file
      maxFiles: 5,        // keep 5 rotated files
      tailable: true,
    }),
  ],
});

module.exports = logger;