/**
 * data/migrate-to-users.js — 数据迁移模块
 *
 * 在运行时初始化阶段执行数据迁移。
 * 通过 SKIP_MIGRATION=true 环境变量可跳过迁移（guest 清理不受影响）。
 */

'use strict';

/**
 * @param {Object} opts
 * @param {Object} [opts.bindingsStore] — teacher-bindings-store 实例
 * @param {string} [opts.dataDir] — 数据目录路径
 * @returns {{ runAll: () => Promise<void> }}
 */
function createMigration(opts) {
  opts = opts || {};

  /**
   * 执行所有待迁移任务。
   * 每个迁移应是幂等的（重复执行安全）。
   * @returns {Promise<void>}
   */
  function runAll() {
    // 当前数据格式已是最新，无需迁移。
    // 保留此钩子供未来数据格式变更时添加迁移逻辑。
    return Promise.resolve();
  }

  return { runAll: runAll };
}

module.exports = { createMigration };
