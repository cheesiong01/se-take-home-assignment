const PROCESSING_TIME_MS = 10_000;

function capitalizeType(type) {
  return type === 'vip' ? 'VIP' : 'Normal';
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class OrderController {
  constructor(logger, options = {}) {
    this.logger = logger;
    this.processingTimeMs = options.processingTimeMs ?? PROCESSING_TIME_MS;
    this.nextOrderId = 1001;
    this.pendingOrders = [];
    this.completedOrders = [];
    this.bots = [];
    this.nextBotId = 1;
  }

  createOrder(type) {
    const order = {
      id: this.nextOrderId++,
      type,
    };

    if (type === 'vip') {
      const firstNormalIndex = this.pendingOrders.findIndex((item) => item.type === 'normal');
      if (firstNormalIndex === -1) {
        this.pendingOrders.push(order);
      } else {
        this.pendingOrders.splice(firstNormalIndex, 0, order);
      }
    } else {
      this.pendingOrders.push(order);
    }

    this.logger.log(
      `Created ${capitalizeType(type)} Order #${order.id} - Status: PENDING`
    );

    this.assignIdleBots();
    return order;
  }

  addBot() {
    const bot = {
      id: this.nextBotId++,
      status: 'IDLE',
      currentOrder: null,
      processToken: 0,
    };

    this.bots.push(bot);
    this.logger.log(`Bot #${bot.id} created - Status: ACTIVE`);
    this.assignWorkToBot(bot);
    return bot;
  }

  removeBot() {
    if (this.bots.length === 0) {
      return null;
    }

    const bot = this.bots.pop();
    bot.processToken += 1;

    if (bot.currentOrder) {
      const order = bot.currentOrder;
      bot.currentOrder = null;
      bot.status = 'IDLE';
      this.returnOrderToQueue(order);
      this.logger.log(
        `Bot #${bot.id} destroyed - ${capitalizeType(order.type)} Order #${order.id} returned to PENDING`
      );
    } else {
      this.logger.log(`Bot #${bot.id} destroyed while IDLE`);
    }

    return bot;
  }

  returnOrderToQueue(order) {
    const insertAt = Math.min(order.queueIndex, this.pendingOrders.length);
    this.pendingOrders.splice(insertAt, 0, order);
  }

  assignIdleBots() {
    for (const bot of this.bots) {
      if (bot.status === 'IDLE' && !bot.currentOrder) {
        this.assignWorkToBot(bot);
      }
    }
  }

  assignWorkToBot(bot) {
    if (bot.status !== 'IDLE' || bot.currentOrder || this.pendingOrders.length === 0) {
      return;
    }

    const queueIndex = 0;
    const order = this.pendingOrders.splice(queueIndex, 1)[0];
    order.queueIndex = queueIndex;
    bot.status = 'PROCESSING';
    bot.currentOrder = order;

    this.logger.log(
      `Bot #${bot.id} picked up ${capitalizeType(order.type)} Order #${order.id} - Status: PROCESSING`
    );

    this.runProcessing(bot, order, bot.processToken);
  }

  async runProcessing(bot, order, token) {
    await sleep(this.processingTimeMs);

    const botStillActive = this.bots.includes(bot);
    const processingNotCancelled = bot.processToken === token;

    if (!botStillActive || !processingNotCancelled || bot.currentOrder !== order) {
      return;
    }

    bot.currentOrder = null;
    bot.status = 'IDLE';
    this.completedOrders.push(order);

    this.logger.log(
      `Bot #${bot.id} completed ${capitalizeType(order.type)} Order #${order.id} - Status: COMPLETE (Processing time: 10s)`
    );

    if (this.pendingOrders.length > 0) {
      this.assignWorkToBot(bot);
      return;
    }

    this.logger.log(`Bot #${bot.id} is now IDLE - No pending orders`);
  }

  getSummary() {
    const vipCompleted = this.completedOrders.filter((order) => order.type === 'vip').length;
    const normalCompleted = this.completedOrders.filter((order) => order.type === 'normal').length;

    return {
      totalProcessed: this.completedOrders.length,
      vipCompleted,
      normalCompleted,
      activeBots: this.bots.length,
      pendingOrders: this.pendingOrders.length,
    };
  }
}

module.exports = { OrderController, PROCESSING_TIME_MS, sleep, capitalizeType };
