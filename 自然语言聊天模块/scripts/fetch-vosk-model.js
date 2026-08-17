/**
 * scripts/fetch-vosk-model.js — 下载离线语音识别模型（约 44MB，不入 git）
 *
 * 用法：npm run fetch-vosk-model
 * 模型源：vosk 官方中文小模型（alphacephei 发布页）
 * 下载到 public/assets/vosk/，已存在则跳过；支持断点续传失败重试（重试 2 次）。
 */

'use strict';

var fs = require('fs');
var path = require('path');
var https = require('https');
var http = require('http');

var MODEL_URL = 'https://alphacephei.com/vosk/models/vosk-model-small-cn-0.22.zip';
var TARGET = path.join(__dirname, '..', 'public', 'assets', 'vosk', 'vosk-model-small-cn-0.22.zip');
var MAX_RETRIES = 2;

function download(url, dest, redirects) {
  return new Promise(function (resolve, reject) {
    var lib = url.startsWith('https:') ? https : http;
    var req = lib.get(url, { headers: { 'User-Agent': 'fetch-vosk-model/1.0' } }, function (res) {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        if ((redirects || 0) > 5) { reject(new Error('too many redirects')); return; }
        download(new URL(res.headers.location, url).href, dest, (redirects || 0) + 1).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error('HTTP ' + res.statusCode));
        return;
      }
      var tmp = dest + '.part';
      var file = fs.createWriteStream(tmp);
      var received = 0;
      res.on('data', function (chunk) {
        received += chunk.length;
        if (received % (5 * 1024 * 1024) < chunk.length) {
          process.stdout.write('\r  已下载 ' + (received / 1024 / 1024).toFixed(1) + ' MB');
        }
      });
      res.pipe(file);
      file.on('finish', function () {
        file.close(function () {
          fs.renameSync(tmp, dest);
          process.stdout.write('\r  已下载 ' + (received / 1024 / 1024).toFixed(1) + ' MB\n');
          resolve(dest);
        });
      });
      file.on('error', function (err) { try { fs.unlinkSync(tmp); } catch (_) {} reject(err); });
    });
    req.on('error', reject);
    req.setTimeout(60000, function () { req.destroy(new Error('timeout')); });
  });
}

async function main() {
  if (fs.existsSync(TARGET) && fs.statSync(TARGET).size > 1000000) {
    console.log('模型已存在（' + (fs.statSync(TARGET).size / 1024 / 1024).toFixed(1) + ' MB），跳过下载。');
    return;
  }
  console.log('下载离线语音识别模型（约 44MB）…');
  console.log('  ' + MODEL_URL);
  for (var attempt = 0; ; attempt++) {
    try {
      await download(MODEL_URL, TARGET, 0);
      console.log('完成：' + TARGET);
      return;
    } catch (err) {
      if (attempt >= MAX_RETRIES) {
        console.error('下载失败：' + err.message + '（已重试 ' + MAX_RETRIES + ' 次）');
        console.error('可手动下载上述地址并放入 ' + path.dirname(TARGET));
        process.exit(1);
      }
      console.log('下载失败（' + err.message + '），重试 ' + (attempt + 1) + '/' + MAX_RETRIES + ' …');
    }
  }
}

main();
