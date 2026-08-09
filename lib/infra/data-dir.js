/**
 * lib/data-dir.js — 统一的 DATA_DIR 解析合同
 *
 * app.js、迁移脚本和初始化工具使用同一个解析函数。
 * 纯函数：只计算路径，不创建目录、不读写文件、不访问环境变量。
 *
 * 导出: resolveDataDir(options)
 */

'use strict';

var path = require('path');

/**
 * @param {object} options
 * @param {string} [options.envValue] — process.env.DATA_DIR 的值（或其他环境变量值）
 * @param {string} options.projectRoot — 仓库根目录的绝对路径
 * @returns {string} 运行数据目录的绝对路径
 */
function resolveDataDir(options) {
  var projectRoot = options.projectRoot;
  var envValue = options.envValue;

  // projectRoot 必须是非空字符串
  if (typeof projectRoot !== 'string' || projectRoot.trim().length === 0) {
    throw new Error('options.projectRoot must be a non-empty string');
  }

  // 如果没有设置 envValue 或为空串/仅空白 → 使用默认路径
  if (typeof envValue !== 'string' || envValue.trim().length === 0) {
    return path.join(projectRoot, 'data');
  }

  var trimmed = envValue.trim();

  // 绝对路径直接使用
  if (path.isAbsolute(trimmed)) {
    return path.resolve(trimmed);
  }

  // 相对路径 → 相对于 projectRoot 解析
  return path.resolve(projectRoot, trimmed);
}

module.exports = { resolveDataDir: resolveDataDir };
