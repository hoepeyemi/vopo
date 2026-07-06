// MemoriVault Agent — autonomous treasury agent with hierarchical self-pruning memory

import { BlockchainService, ContractAddresses } from './blockchain.js';
import { LLMService } from './llm.js';
import { AgentWebSocket } from './websocket.js';
import {
  analyzeInvoice,
  applyMarketAdjustment,
  updateMarketRegime,
  applyRegimeAdjustment,
  getCurrentRegime,
} from './optimizer.js';
import {
  AgentConfig,
  AgentThought,
  Strategy,
  AnalysisResult,
  MarketConditions,
  MarketAlert,
} from './types.js';
import { STRATEGY_NAMES } from './constants.js';
import { MemorySystem } from './memory/index.js';

export class VasmoAgent {
  private blockchain: BlockchainService;
  private llm: LLMService;
  private ws: AgentWebSocket;
  private config: AgentConfig;
  private memory: MemorySystem;
  private isRunning = false;
  private analysisLoop: NodeJS.Timeout | null = null;

  private lastAnalysisTime: Map<string, number> = new Map();
  private readonly ANALYSIS_COOLDOWN_MS = 5 * 60 * 1000;

  private consecutiveFailures = 0;
  private readonly MAX_CONSECUTIVE_FAILURES = 3;
  private circuitBreakerOpen = false;
  private circuitBreakerResetTime = 0;
  private readonly CIRCUIT_BREAKER_TIMEOUT_MS = 60 * 1000;

  constructor(
    rpcUrl: string,
    addresses: ContractAddresses,
    options: {
      privateKey?: string;
      qwenApiKey?: string;
      wsPort?: number;
      config?: Partial<AgentConfig>;
    } = {},
  ) {
    this.blockchain = new BlockchainService(rpcUrl, addresses, options.privateKey);
    this.llm = new LLMService(options.qwenApiKey);
    this.ws = new AgentWebSocket(options.wsPort || 8080);
    this.memory = new MemorySystem();

    this.config = {
      minConfidence: 70,
      analysisInterval: 30000,
      maxConcurrentAnalyses: 5,
      autoExecute: true,
      ...options.config,
    };

    this.ws.onAnalysisRequest = (tokenId) => {
      this.analyzeInvoice(tokenId).catch((e) =>
        console.error(`analyzeInvoice(${tokenId}) unhandled:`, e),
      );
    };

    // Relay memory events to connected WebSocket clients
    this.memory.onMemoryEvent((event) => {
      this.ws.broadcastMemoryEvent(event);
      const icon = { created: '🧠', recalled: '💭', pruned: '🗑️', condensed: '🧬' }[event.type];
      console.log(`${icon} [Memory:${event.tier}] ${event.summary}`);
    });
  }

  async start(): Promise<void> {
    if (this.isRunning) return;

    console.log('🤖 MemoriVault Agent starting...');

    this.ws.start();

    const agentAddress = this.blockchain.getAgentAddress();
    if (agentAddress) {
      const authorized = await this.blockchain.isAgentAuthorized(agentAddress);
      if (!authorized) {
        console.warn(`⚠️  Agent ${agentAddress} is not authorized on AgentRouter`);
      } else {
        console.log(`✅ Agent ${agentAddress} is authorized`);
      }
    } else {
      console.warn('⚠️  No private key — read-only mode');
    }

    // Start memory maintenance (decay, prune, condense) in the background
    this.memory.startMaintenance(this.llm);

    this.isRunning = true;
    this.setupEventListeners();

    this.broadcastThought({
      type: 'thinking',
      tokenId: 'system',
      message: '🏦 MemoriVault Agent is active — hierarchical memory online',
      timestamp: Date.now(),
      data: {
        memoryStats: this.memory.stats(),
      },
    });

    this.startAnalysisLoop();
    console.log('🤖 MemoriVault Agent started');
  }

  stop(): void {
    if (!this.isRunning) return;
    if (this.analysisLoop) {
      clearInterval(this.analysisLoop);
      this.analysisLoop = null;
    }
    this.memory.stopMaintenance();
    this.ws.stop();
    this.isRunning = false;
    console.log('🤖 MemoriVault Agent stopped');
  }

  private setupEventListeners(): void {
    this.blockchain.onDecisionRecorded((tokenId, strategy, confidence) => {
      this.broadcastThought({
        type: 'execution',
        tokenId,
        message: `📡 On-chain: Decision recorded — ${STRATEGY_NAMES[strategy]} (${confidence}% confidence)`,
        timestamp: Date.now(),
        data: { strategy: STRATEGY_NAMES[strategy], confidence },
      });
    });

    this.blockchain.onDecisionExecuted((tokenId, strategy) => {
      this.broadcastThought({
        type: 'execution',
        tokenId,
        message: `📡 On-chain: Strategy changed to ${STRATEGY_NAMES[strategy]}`,
        timestamp: Date.now(),
        data: { strategy: STRATEGY_NAMES[strategy] },
      });
    });

    console.log('✅ Contract event listeners initialized');
  }

  private isRateLimited(tokenId: string): boolean {
    const last = this.lastAnalysisTime.get(tokenId);
    return last !== undefined && Date.now() - last < this.ANALYSIS_COOLDOWN_MS;
  }

  private checkCircuitBreaker(): boolean {
    if (!this.circuitBreakerOpen) return false;
    if (Date.now() > this.circuitBreakerResetTime) {
      this.circuitBreakerOpen = false;
      this.consecutiveFailures = 0;
      console.log('🔄 Circuit breaker reset');
      return false;
    }
    return true;
  }

  private tripCircuitBreaker(): void {
    this.circuitBreakerOpen = true;
    this.circuitBreakerResetTime = Date.now() + this.CIRCUIT_BREAKER_TIMEOUT_MS;
    console.warn(`⚠️ Circuit breaker tripped after ${this.consecutiveFailures} failures`);
  }

  private startAnalysisLoop(): void {
    this.runAnalysisCycle();
    this.analysisLoop = setInterval(() => this.runAnalysisCycle(), this.config.analysisInterval);
  }

  private currentMarketConditions: MarketConditions | null = null;
  private currentMarketAlert: MarketAlert | null = null;

  private async runAnalysisCycle(): Promise<void> {
    const CYCLE_TIMEOUT_MS = 60_000;
    let timeoutHandle: NodeJS.Timeout;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => reject(new Error('Analysis cycle timeout')), CYCLE_TIMEOUT_MS);
    });

    try {
      await Promise.race([this.runAnalysisCycleInternal(), timeoutPromise]);
      clearTimeout(timeoutHandle!);
    } catch (error) {
      clearTimeout(timeoutHandle!);
      if (error instanceof Error && error.message === 'Analysis cycle timeout') {
        console.error('⚠️ Cycle timed out');
        this.broadcastThought({
          type: 'error',
          tokenId: 'system',
          message: '⏱️ Analysis cycle timed out — retrying next interval',
          timestamp: Date.now(),
        });
        this.tripCircuitBreaker();
      } else {
        throw error;
      }
    }
  }

  private async runAnalysisCycleInternal(): Promise<void> {
    if (this.checkCircuitBreaker()) {
      console.log('⏸️ Circuit breaker open, skipping cycle');
      return;
    }

    try {
      this.broadcastThought({
        type: 'thinking',
        tokenId: 'system',
        message: '📡 Checking market conditions via Pyth Oracle...',
        timestamp: Date.now(),
      });

      this.currentMarketConditions = await this.blockchain.getMarketConditions();
      this.currentMarketAlert = this.blockchain.checkMarketAlert(this.currentMarketConditions);

      const regime = updateMarketRegime(this.currentMarketConditions);

      // Keep L1 working memory current
      this.memory.l1.setMarketRegime(regime);
      this.memory.l1.touchCycle();

      if (this.currentMarketAlert) {
        const alertEmoji =
          this.currentMarketAlert.level === 'critical'
            ? '🚨'
            : this.currentMarketAlert.level === 'warning'
              ? '⚠️'
              : 'ℹ️';

        this.broadcastThought({
          type: this.currentMarketAlert.level === 'critical' ? 'error' : 'analysis',
          tokenId: 'market',
          message: `${alertEmoji} ${this.currentMarketAlert.message}`,
          timestamp: Date.now(),
          data: {
            priceChange: this.currentMarketConditions.ethPriceChange24h,
            volatility: this.currentMarketConditions.volatilityLevel,
            ethPrice: this.currentMarketConditions.ethPrice,
          },
        });

        await this.delay(800);

        this.broadcastThought({
          type: 'decision',
          tokenId: 'market',
          message: `🤖 ${this.currentMarketAlert.recommendation}`,
          timestamp: Date.now(),
        });

        // Log significant market events to episodic memory
        if (this.currentMarketAlert.level === 'critical') {
          await this.memory.logEpisode({
            content: `CRITICAL market alert: ${this.currentMarketAlert.message}. ETH price change: ${this.currentMarketConditions.ethPriceChange24h.toFixed(1)}%. All strategies forced to Hold.`,
            tags: ['market-regime'],
            marketRegime: regime,
            metadata: {
              priceChange: this.currentMarketConditions.ethPriceChange24h,
              volatility: this.currentMarketConditions.volatilityLevel,
            },
          });
        }
      } else {
        const priceInfo = this.currentMarketConditions.ethPrice
          ? `ETH: $${this.currentMarketConditions.ethPrice.toFixed(2)}`
          : 'Prices: Simulated mode';
        const regimeEmoji =
          regime === 'bull' ? '📈' : regime === 'bear' ? '📉' : regime === 'volatile' ? '🌊' : '⚖️';

        this.broadcastThought({
          type: 'thinking',
          tokenId: 'system',
          message: `✅ Market ${regime} ${regimeEmoji} (${priceInfo}) — volatility: ${this.currentMarketConditions.volatilityLevel}`,
          timestamp: Date.now(),
          data: { regime, volatility: this.currentMarketConditions.volatilityLevel },
        });
      }

      await this.delay(300);

      this.broadcastThought({
        type: 'thinking',
        tokenId: 'system',
        message: '🔍 Scanning blockchain for invoices...',
        timestamp: Date.now(),
      });

      const [invoicesResult, depositsResult] = await Promise.all([
        this.blockchain.getActiveInvoices(),
        this.blockchain.getActiveDeposits(),
      ]);

      if (invoicesResult.error || depositsResult.error) {
        const errors = [invoicesResult.error, depositsResult.error].filter(Boolean).join(', ');
        this.broadcastThought({
          type: 'error',
          tokenId: 'system',
          message: `⚠️ Contract call failed: ${errors}. Retrying next cycle.`,
          timestamp: Date.now(),
        });
        return;
      }

      const allTokenIds = [...new Set([...invoicesResult.ids, ...depositsResult.ids])];

      if (allTokenIds.length === 0) {
        this.broadcastThought({
          type: 'thinking',
          tokenId: 'system',
          message: '📭 No invoices found — waiting for new invoices to be minted...',
          timestamp: Date.now(),
        });
        return;
      }

      this.memory.l1.setActiveInvoices(allTokenIds);

      const depositCount = depositsResult.ids.length;
      const pendingCount = allTokenIds.length - depositCount;

      this.broadcastThought({
        type: 'thinking',
        tokenId: 'system',
        message: `📊 Found ${allTokenIds.length} invoice(s): ${depositCount} earning yield, ${pendingCount} pending. Analyzing...`,
        timestamp: Date.now(),
        data: { memoryStats: this.memory.stats() },
      });

      const analysisPromises = allTokenIds
        .slice(0, this.config.maxConcurrentAnalyses)
        .map((tokenId) => this.analyzeInvoice(tokenId));

      await Promise.allSettled(analysisPromises);

      const txCost = await this.blockchain.getEstimatedTxCost();

      this.broadcastThought({
        type: 'thinking',
        tokenId: 'system',
        message: `✅ Cycle complete. Next scan in ${this.config.analysisInterval / 1000}s | Tx: ${txCost.costUsd} | Memory: L2:${this.memory.stats().l2Count} L3:${this.memory.stats().l3Count}`,
        timestamp: Date.now(),
        data: { txCostUsd: txCost.costUsd, memoryStats: this.memory.stats() },
      });

      this.consecutiveFailures = 0;
    } catch (error) {
      console.error('Error in analysis cycle:', error);
      this.ws.broadcastError('system', `Analysis cycle error: ${error}`);
      this.consecutiveFailures++;
      if (this.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
        this.tripCircuitBreaker();
        this.broadcastThought({
          type: 'error',
          tokenId: 'system',
          message: `⚠️ Too many failures (${this.consecutiveFailures}). Pausing for 1 minute...`,
          timestamp: Date.now(),
        });
      }
    }
  }

  async analyzeInvoice(tokenId: string): Promise<AnalysisResult | null> {
    if (this.isRateLimited(tokenId)) {
      console.log(`⏳ Invoice #${tokenId} rate-limited`);
      return null;
    }

    // Reserve the slot immediately so concurrent WS + cycle calls don't both proceed
    this.lastAnalysisTime.set(tokenId, Date.now());

    try {
      const [invoice, deposit] = await Promise.all([
        this.blockchain.getInvoice(tokenId),
        this.blockchain.getDeposit(tokenId),
      ]);

      if (!invoice) {
        this.ws.broadcastError(tokenId, `Invoice #${tokenId} not found`);
        return null;
      }

      const isDeposited = deposit !== null;
      const regime = getCurrentRegime();

      this.broadcastThought({
        type: 'thinking',
        tokenId,
        message: `🔍 Analyzing Invoice #${tokenId}${isDeposited ? ' (earning yield)' : ' (awaiting deposit)'}...`,
        timestamp: Date.now(),
        data: { step: 1, total: 5, isDeposited },
      });

      // ── RAG: retrieve relevant memories before reasoning ──────────────────
      const queryText = [
        `invoice ${tokenId}`,
        `risk score ${invoice.riskScore}`,
        `payment probability ${invoice.paymentProbability}`,
        `market ${regime}`,
        isDeposited ? `strategy ${STRATEGY_NAMES[deposit!.strategy]}` : 'undeposited',
      ].join(' ');

      const memoryResult = await this.memory.query(queryText, 3);

      if (memoryResult.l3Rules.length > 0 || memoryResult.l2Episodes.length > 0) {
        this.broadcastThought({
          type: 'thinking',
          tokenId,
          message: `🧠 Memory: recalled ${memoryResult.l3Rules.length} rules + ${memoryResult.l2Episodes.length} past episodes`,
          timestamp: Date.now(),
          data: {
            l3Rules: memoryResult.l3Rules.map((r) => r.rule),
            l2Count: memoryResult.l2Episodes.length,
          },
        });
      }

      await this.delay(200);

      const currentTimestamp = Math.floor(Date.now() / 1000);
      let analysis = analyzeInvoice(invoice, deposit || undefined, currentTimestamp);
      const originalStrategy = analysis.recommendedStrategy;

      analysis = applyMarketAdjustment(analysis, this.currentMarketConditions, this.currentMarketAlert);
      analysis = applyRegimeAdjustment(analysis);
      const wasAdjusted = originalStrategy !== analysis.recommendedStrategy;

      await this.delay(400);
      this.broadcastThought({
        type: 'analysis',
        tokenId,
        message: `📈 Risk: ${analysis.riskScore}/100 | Payment: ${analysis.paymentProbability}% | Days to due: ${analysis.daysUntilDue}`,
        timestamp: Date.now(),
        data: {
          riskScore: analysis.riskScore,
          paymentProbability: analysis.paymentProbability,
          daysUntilDue: analysis.daysUntilDue,
        },
      });

      await this.delay(400);

      if (wasAdjusted && this.currentMarketAlert) {
        this.broadcastThought({
          type: 'analysis',
          tokenId,
          message: `⚡ MARKET OVERRIDE: ${STRATEGY_NAMES[analysis.currentStrategy]} → ${STRATEGY_NAMES[analysis.recommendedStrategy]} (was ${STRATEGY_NAMES[originalStrategy]})`,
          timestamp: Date.now(),
          data: {
            currentStrategy: STRATEGY_NAMES[analysis.currentStrategy],
            recommendedStrategy: STRATEGY_NAMES[analysis.recommendedStrategy],
            confidence: analysis.confidence,
            marketOverride: true,
          },
        });
      } else {
        this.broadcastThought({
          type: 'analysis',
          tokenId,
          message: `🎯 Strategy: ${STRATEGY_NAMES[analysis.currentStrategy]} → ${STRATEGY_NAMES[analysis.recommendedStrategy]} (${analysis.confidence}% confidence)`,
          timestamp: Date.now(),
          data: {
            currentStrategy: STRATEGY_NAMES[analysis.currentStrategy],
            recommendedStrategy: STRATEGY_NAMES[analysis.recommendedStrategy],
            confidence: analysis.confidence,
            shouldAct: analysis.shouldAct,
          },
        });
      }

      // ── LLM explanation with memory context ──────────────────────────────
      await this.delay(400);
      const explanation = await this.llm.generateExplanation(
        analysis,
        memoryResult.contextString || undefined,
      );

      this.broadcastThought({
        type: 'decision',
        tokenId,
        message: explanation,
        timestamp: Date.now(),
        data: {
          shouldAct: analysis.shouldAct,
          strategy: analysis.recommendedStrategy,
          memoryInfluenced: memoryResult.contextString.length > 0,
        },
      });

      if (analysis.shouldAct && this.config.autoExecute) {
        if (isDeposited) {
          await this.executeDecision(tokenId, analysis, regime);
        } else {
          this.broadcastThought({
            type: 'thinking',
            tokenId,
            message: `💡 Invoice #${tokenId} not yet deposited. Deposit it to activate ${STRATEGY_NAMES[analysis.recommendedStrategy]} strategy.`,
            timestamp: Date.now(),
            data: { recommendedStrategy: STRATEGY_NAMES[analysis.recommendedStrategy], awaitingDeposit: true },
          });
        }
      }

      return analysis;
    } catch (error) {
      console.error(`Error analyzing invoice ${tokenId}:`, error);
      this.ws.broadcastError(tokenId, `Analysis failed: ${error}`);
      return null;
    }
  }

  private async executeDecision(
    tokenId: string,
    analysis: AnalysisResult,
    marketRegime: string,
  ): Promise<void> {
    this.broadcastThought({
      type: 'execution',
      tokenId,
      message: `⚡ Executing: Change to ${STRATEGY_NAMES[analysis.recommendedStrategy]} strategy...`,
      timestamp: Date.now(),
    });

    const result = await this.blockchain.recordDecision(
      tokenId,
      analysis.recommendedStrategy,
      analysis.confidence,
      analysis.reasoning,
    );

    if (result.success) {
      this.ws.broadcastExecution(tokenId, true, result.txHash);
      this.broadcastThought({
        type: 'execution',
        tokenId,
        message: `✅ Strategy updated to ${STRATEGY_NAMES[analysis.recommendedStrategy]}`,
        timestamp: Date.now(),
        data: { txHash: result.txHash },
      });

      // ── Log outcome to L2 episodic memory ──────────────────────────────
      await this.memory.logEpisode({
        content: [
          `Invoice #${tokenId}: Changed strategy from ${STRATEGY_NAMES[analysis.currentStrategy]}`,
          `to ${STRATEGY_NAMES[analysis.recommendedStrategy]}.`,
          `Market: ${marketRegime}. Risk score: ${analysis.riskScore}/100.`,
          `Payment probability: ${analysis.paymentProbability}%.`,
          `Days until due: ${analysis.daysUntilDue}. Confidence: ${analysis.confidence}%.`,
          result.txHash ? `Tx: ${result.txHash.slice(0, 10)}...` : '',
        ]
          .filter(Boolean)
          .join(' '),
        tags: ['yield-strategy', 'invoice-outcome'],
        tokenId,
        strategy: STRATEGY_NAMES[analysis.recommendedStrategy],
        outcome: 'pending',
        marketRegime,
        metadata: {
          fromStrategy: STRATEGY_NAMES[analysis.currentStrategy],
          toStrategy: STRATEGY_NAMES[analysis.recommendedStrategy],
          riskScore: analysis.riskScore,
          confidence: analysis.confidence,
          txHash: result.txHash,
        },
      });

      this.memory.recordDecision(tokenId, STRATEGY_NAMES[analysis.recommendedStrategy]);
    } else {
      this.ws.broadcastExecution(tokenId, false);
      this.broadcastThought({
        type: 'error',
        tokenId,
        message: '❌ Strategy update failed — will retry next cycle',
        timestamp: Date.now(),
      });
    }
  }

  private broadcastThought(thought: AgentThought): void {
    this.ws.broadcastThought(thought);
    const prefix = { thinking: '💭', analysis: '📊', decision: '🎯', execution: '⚡', error: '❌' }[
      thought.type
    ];
    console.log(`${prefix} [${thought.tokenId}] ${thought.message}`);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async triggerAnalysis(tokenId: string): Promise<AnalysisResult | null> {
    return this.analyzeInvoice(tokenId);
  }

  getStatus(): { running: boolean; connectedClients: number; config: AgentConfig; memoryStats: ReturnType<MemorySystem['stats']> } {
    return {
      running: this.isRunning,
      connectedClients: this.ws.getConnectedClients(),
      config: this.config,
      memoryStats: this.memory.stats(),
    };
  }
}
