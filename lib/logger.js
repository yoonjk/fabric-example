
var winston = require('winston');
var logger = winston.createLogger({
    level: 'error',
    transports: [
        new winston.transports.Console({
                level: process.env.ENVIRONMENT === 'development' ?  'info' : 'silly'
        })
    ],
    exitOnError: false
});

module.exports = {
  logger : logger
}
