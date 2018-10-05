#!/usr/bin/env node

/**
 * Module dependencies.
 */
var express = require('express');
var logger = require('morgan');
var bodyParser = require('body-parser');
var path = require('path');
var request = require('request');

var app;

function processConfig( config ) {
  process.env.PORT = config['host'] && config['host']['port'] ? config['host']['port'] : '3000';
}

function initExpress() {
  app = express();

  app.use(logger('dev'));
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: false }));
}
function configureExpress( config ) {
  if ( config['proxies'] && config['proxies'].length ) {
    for( var i in config['proxies'] ) {
      const proxyTo = config['proxies'][i];
      const suffix = proxyTo['suffix'] || '';
      app.use( proxyTo.prefix + suffix, function(req, res) {
        var headers = {}, requestConfig = {
          url: proxyTo.host + proxyTo.root + (suffix && suffix === '/:any(*)' ? req.params.any : ''),
          method: req.method
        };
        if( proxyTo.headersPreset ) {
          headers = proxyTo.headersPreset;
        }
        if(proxyTo.headers && proxyTo.headers.length) {
          proxyTo.headers.map( function(h) {
            if( req.headers[h] ) {
              headers[h] = req.headers[h];
            }
          });
        }

        if( req.method != 'GET' ) {
          requestConfig.body = req.body;
          requestConfig.json = true;
        }
        requestConfig.headers = headers;

        console.log('\nProxy Request => ');
        console.log(' Origin: ', proxyTo.prefix + suffix);
        for( var key in headers) {
          console.log(' ' + key, ': ', headers[key]);
        }
        console.log(' ' + requestConfig.url);
        console.log('\n');

        request(requestConfig, function(err, response, body) {
          res.status( response.statusCode ).send( body );
        });
      });
    }
  }
  if ( config['ui'] && config['ui'].length ) {
    for( var i in config['ui'] ) {
      const ui = config['ui'][i];
      app.use(ui['route'], express.static(path.join(config.baseDir, ui['path'], process.env.NODE_ENV) ));
      app.use( ui['route'], function(req, rep) {
        rep.sendFile( path.join(config.baseDir, ui['path'], process.env.NODE_ENV, 'index.'+process.env.NODE_ENV+'.html'));
      });
    }
  }
}
function bootstrapServer() {
  var debug = require('debug')('express-proxy:server');
  var http = require('http');

  /**
   * Get port from environment and store in Express.
   */

  var port = normalizePort(process.env.PORT || '3000');
  app.set('port', port);

  /**
   * Create HTTP server.
   */

  var server = http.createServer(app);

  /**
   * Listen on provided port, on all network interfaces.
   */

  server.listen(port);
  server.on('error', onError);
  server.on('listening', onListening);

  /**
   * Normalize a port into a number, string, or false.
   */

  function normalizePort(val) {
    var port = parseInt(val, 10);

    if (isNaN(port)) {
      // named pipe
      return val;
    }

    if (port >= 0) {
      // port number
      return port;
    }

    return false;
  }

  /**
   * Event listener for HTTP server "error" event.
   */

  function onError(error) {
    if (error.syscall !== 'listen') {
      throw error;
    }

    var bind = typeof port === 'string'
      ? 'Pipe ' + port
      : 'Port ' + port;

    // handle specific listen errors with friendly messages
    switch (error.code) {
      case 'EACCES':
        console.error(bind + ' requires elevated privileges');
        process.exit(1);
        break;
      case 'EADDRINUSE':
        console.error(bind + ' is already in use');
        process.exit(1);
        break;
      default:
        throw error;
    }
  }

  /**
   * Event listener for HTTP server "listening" event.
   */

  function onListening() {
    var addr = server.address();
    var bind = typeof addr === 'string'
      ? 'pipe ' + addr
      : 'port ' + addr.port;
    debug('Listening on ' + bind);
    console.log('Listening on ' + bind);
  }
}


module.exports = function( config ) {
  processConfig( config );
  initExpress();
  configureExpress( config );
  bootstrapServer();

  return {
    app: app
  }
}
