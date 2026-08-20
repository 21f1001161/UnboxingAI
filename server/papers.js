import { cached } from './cache.js';

export const PAPERS_URL = process.env.PAPERS_URL || 'https://raw.githubusercontent.com/dair-ai/AI-Papers-of-the-Week/main/years/2026.md';
const PAPERS_TTL = 60 * 60 * 1000; // 1 hour cache

const slug = value => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 72);

// Topic tags mapping for each research paper to make filtering and exploration rich
const PAPER_TAGS = {
  'Skaling': ['Research', 'Scaling Laws', 'Pretraining', 'Loss Estimation'],
  'Stealing Reasoning Traces': ['Research', 'Reasoning', 'Security', 'LLM Privacy', 'Jailbreaks'],
  'Mind Viruses': ['Research', 'Autonomous Agents', 'Safety', 'Multi-Agent', 'Anthropic'],
  'Catastrophic Remembering': ['Research', 'Agentic Coding', 'Prompting', 'Continual Learning'],
  'The Bitter Lesson of Tool Calling': ['Research', 'Tool Calling', 'Agent Architectures', 'Benchmarks'],
  'Reason Wide, Not Deep': ['Research', 'Reasoning', 'Distillation', 'Search', 'Inference Cost'],
  'Harness-IF': ['Research', 'Instruction Following', 'Agent Harness', 'Evaluation'],
  'Lost in Compaction': ['Research', 'Context Compaction', 'Long-Context', 'Memory'],
  'Cracks in the Foundation': ['Research', 'Transformer Architecture', 'Long-Context', 'GQA'],
  'CEDAR': ['Research', 'Complex Systems', 'MCTS', 'Sakana AI', 'Agents'],
  'Model or Harness': ['Research', 'Agent Evaluation', 'Taxonomy', 'Scaffolding'],
  'Zero-Mem': ['Research', 'Agent Memory', 'Indexing', 'Zero-Token Ops'],
  'Sample More Reflect Less': ['Research', 'Self-Reflection', 'Sampling', 'Test-Time Compute'],
  'Harness-R1': ['Research', 'RL', 'Self-Improving Agents', 'Harness Engineering'],
  'DataSpace': ['Research', 'Data Analytics', 'Multimodal', 'Benchmarks', 'KDD Cup'],
  'Prompt-Induced Waste': ['Research', 'Prompt Engineering', 'Coding Agents', 'Efficiency'],
  'Rehearse': ['Research', 'AutoResearch', 'LLM Judge', 'Self-Improving Loops'],
  'ContinualSkillBench': ['Research', 'Skill Libraries', 'Lifelong Learning', 'Agent Harness'],
  'MerchantBench': ['Research', 'Long-Horizon Agents', 'Simulation', 'E-Commerce'],
  'TokTier': ['Research', 'Tokenization', 'Serving Stacks', 'vLLM', 'Inference Latency'],
};

const COLOR_CYCLE = ['violet', 'sky', 'coral', 'lime', 'amber'];

/**
 * Fallback dataset containing the top 2 headings (20 papers total) from DAIR.AI's 2026 repository.
 */
export const FALLBACK_PAPERS = [
  // Week 1: August 10 - August 16, 2026
  {
    weekTitle: 'Top AI Papers of the Week (August 10 - August 16) - 2026',
    dateRange: 'August 10 - August 16, 2026',
    dateLabel: 'AUG 10-16',
    published: '2026-08-16',
    papers: [
      {
        num: 1,
        title: 'Skaling',
        headline: 'Skaling: Coupling Capacity and Data in Neural Scaling Laws',
        tldr: 'Standard neural scaling laws assume model size and training data act on loss independently. Skaling generalizes the Chinchilla form by coupling capacity and data through a single interaction exponent.',
        fullContent: 'Standard neural scaling laws assume model size and training data act on loss independently. That assumption bakes in a cross-derivative of exactly zero, and it is why the Chinchilla form drifts at the data-scarce and heavy-overtraining edges of the grid, which is exactly where deployment now happens. <br>● One extra parameter, one coupling: The Skaling law generalizes the Chinchilla form by coupling capacity and data through a single interaction exponent, restoring the interaction that the additive form discards while adding only one parameter. <br>● Errors shrink where they were worst: The extra term reduces mean absolute percentage error by 1.5x to 3x across both interpolation and extrapolation, and Skaling wins on 76% of configurations with a median improvement of 2.2x. The largest corrections land in the corners where standard laws show a saddle-shaped residual. <br>● Cheaper profiling grids: Paired with an L-shape sparse grid restricted to low-compute runs, sweeping data volume for small models and model size at a fixed small data budget, it extrapolates the full grid using roughly 10x less compute than a uniform sweep. <br>● Why it matters: Pretraining budgets are planned from fits to small runs, so a functional form that stays accurate past compute optimal and can be fit cheaply changes how those decisions get made.',
        paperUrl: 'https://arxiv.org/abs/2608.07222',
        tweetUrl: 'https://x.com/omarsar0/status/2086845790983716917',
        whyMatters: 'Pretraining budgets are planned from fits to small runs, so a functional form that stays accurate past compute optimal and can be fit cheaply changes how major training decisions get made.',
        bullets: [
          'One extra parameter, one coupling: Generalizes the Chinchilla form by coupling capacity and data through a single interaction exponent.',
          'Errors shrink where they were worst: Reduces mean absolute percentage error by 1.5x to 3x across interpolation and extrapolation, winning on 76% of configurations.',
          'Cheaper profiling grids: Extrapolates the full grid using ~10x less compute than a uniform sweep when paired with an L-shape sparse grid.',
        ],
      },
      {
        num: 2,
        title: 'Stealing Reasoning Traces',
        headline: 'Stealing Reasoning Traces: Cross-Model Chain-of-Thought Extraction',
        tldr: 'Frontier providers hide chain-of-thought in encrypted blocks returned to clients. This work identifies an architectural flaw turning interchangeable encrypted blocks into a scalable extraction attack across three frontier providers.',
        fullContent: 'Frontier providers hide chain-of-thought and hand the client an encrypted block instead, which the client returns with every subsequent request. This work identifies an architectural flaw in that design and turns it into a scalable extraction attack across three providers. <br>● The blocks are interchangeable: Encrypted reasoning blocks are fully compatible across sessions, users, and models inside a single provider ecosystem, and that compatibility is the whole vulnerability. <br>● A weaker sibling does the decoding: Inject an encrypted trace from a strong model into a weaker, less safeguarded model from the same provider and it decodes and emits the trace verbatim in plaintext. The capable model is never jailbroken directly. <br>● Four attack vectors, not one: It circumvents anti-distillation across Anthropic, OpenAI, and Google. Decoding 315,320 blocks scraped from public repositories recovered 367 PII artifacts and 182 credentials. <br>● Why it matters: Teams publish session logs assuming the encrypted blobs are opaque, and they are not. The authors disclosed responsibly and propose cryptographic mitigations.',
        paperUrl: 'https://arxiv.org/abs/2608.09867',
        tweetUrl: 'https://x.com/omarsar0/status/2087187835530948776',
        whyMatters: 'Teams publish session logs assuming encrypted reasoning blobs are opaque. This vulnerability allows verbatim decoding of hidden CoT and extracted sensitive credentials across multiple ecosystems.',
        bullets: [
          'The blocks are interchangeable: Encrypted reasoning blocks are fully compatible across sessions, users, and models inside a single provider ecosystem.',
          'A weaker sibling does the decoding: Injecting an encrypted trace from a strong model into a weaker model emits the trace verbatim in plaintext.',
          'Four attack vectors: Circumvents anti-distillation, recovers PII/credentials, exposes hazardous content, and enables invisible prompt injections.',
        ],
      },
      {
        num: 3,
        title: 'Mind Viruses',
        headline: 'Mind Viruses: Propagation and Evolution of Ideas in Multi-Agent Systems',
        tldr: 'Anthropic studies risks emerging from agent-to-agent interactions: self-replicating ideas and payloads that propagate through multi-agent systems by inducing each host agent to transmit them onward.',
        fullContent: 'As agents get more autonomous and more interconnected, risks start coming from agent-to-agent interaction rather than from any single model. This work from Anthropic studies one of them directly: ideas that propagate through a multi-agent system by inducing each host to transmit them onward. <br>● Evolved, not hand-written: The payloads are constructed with a simple evolutionary algorithm rather than authored. <br>● Two settings, one result: Propagation works both in a small team of agents collaborating on a shared coding project and in a chain of agents that interact briefly with context wiped between sessions. <br>● What governs the spread: Host model, the agent\'s existing instructions, payload harmfulness, and network topology. <br>● Why it matters: A brief warning in the system prompt confers near-total immunity, which is an unusually cheap mitigation for a novel risk class.',
        paperUrl: 'https://arxiv.org/abs/2608.10218',
        tweetUrl: 'https://x.com/omarsar0/status/2087574841893474556',
        whyMatters: 'Demonstrates that multi-agent shared workflows can propagate evolutionary prompt viruses, while also proving that simple system-prompt safety guards provide cheap, near-total immunity.',
        bullets: [
          'Evolved, not hand-written: Payloads constructed with evolutionary algorithms measure what spreads naturally in agent networks.',
          'Propagation across context wipes: Payloads survive context wipes between sessions through shared artifacts (e.g. repo files).',
          'Cheap mitigation: A brief warning in the system prompt confers near-total immunity against viral propagation.',
        ],
      },
      {
        num: 4,
        title: 'Catastrophic Remembering',
        headline: 'Catastrophic Remembering: Why Agentic Coding READMEs Grow Without Bound',
        tldr: 'Agentic coding prompts and system files accumulate instructions indefinitely because deleting old instructions carries high verification cost. The paper proposes latent reasoning comments to prune excess instructions.',
        fullContent: 'Agentic coding READMEs grow without bound in real repositories, stopping only when the repo retires or someone rewrites the file wholesale. This paper traces the cause to imperfect recall. <br>● The asymmetry is the mechanism: Appending an instruction is always cheap. Once its rationale is gone, deleting it without risking a correctness regression costs O(2^|D|) in a prompt of |D| instructions, so nobody deletes anything. <br>● Measured across 1,867 repositories: Over 247,694 instruction lifetimes, agentic prompts more than tripled over their lifetime at +226% and gained 4.9 net instructions per commit. <br>● The proposed fix is comments: Inverting IFEval yields verifiable worlds with known optimal prompts, and comments encoding latent reasoning remove 99.3% of excess instructions there. <br>● Why it matters: If English is the new code, comments encoding reasoning prevent prompt bloat and improve agentic instruction following by up to 23.1%.',
        paperUrl: 'https://arxiv.org/abs/2608.11095',
        tweetUrl: 'https://x.com/omarsar0/status/2087605040240582991',
        whyMatters: 'Explains the ratchet mechanism behind prompt bloat in real agent repos and introduces reasoning comments to eliminate 99.3% of excess instructions while improving compliance by 23.1%.',
        bullets: [
          'The asymmetry mechanism: Appending instructions is cheap, but deleting without regression requires exponential verification cost.',
          'Empirical study: Studied 1,867 repos across 247,694 instruction lifetimes, finding prompts grew +226% on average.',
          'Latent reasoning comments: Preserves rationale so instructions can be pruned cleanly, improving real agent performance by up to 23.1%.',
        ],
      },
      {
        num: 5,
        title: 'The Bitter Lesson of Tool Calling',
        headline: 'The Bitter Lesson of Tool Calling: Programmatic vs JSON Interfaces',
        tldr: 'Exposing tools to code-capable LLMs as executable Python stubs rather than JSON schemas enables natural chaining and outperforms JSON tool calling on 11 of 14 frontier models.',
        fullContent: 'Tool calling is a design choice and the default choice is JSON. For code-capable models, exposing tools as code instead lets calls chain and parallelize naturally. <br>● The setup: Programmatic tool calling exposes tools as typed Python stubs the model invokes through code, with execution and results handled inside a single agent turn on BFCL v4. <br>● It wins on most models: Programmatic tool calling matches or exceeds JSON tool calling in 11 of 14 models, and the GPT-5.6 family gains 10.6% over the JSON baseline. <br>● The gap widens under pressure: Under parallel fan-out it matches or beats the baseline in 13 of 14 models, and under context rot it holds steady. <br>● Why it matters: The advantage tracks model capability across release generations, making programmatic tool calling the natural interface choice.',
        paperUrl: 'https://arxiv.org/abs/2608.06370',
        tweetUrl: 'https://x.com/dair_ai/status/2086846794840019178',
        whyMatters: 'Demonstrates that code-as-tool-interface outperforms JSON schema across modern LLMs, widening its lead during parallel calls and long-context load.',
        bullets: [
          'Programmatic tool interface: Exposes tools as typed Python stubs executed in one agent turn instead of multi-step JSON roundtrips.',
          'Widespread performance gain: Beats or matches JSON tool calling in 11 of 14 models, with +10.6% gains on top models.',
          'Robust under context pressure: Holds steady against context rot where JSON tool calling degrades.',
        ],
      },
      {
        num: 6,
        title: 'Reason Wide, Not Deep',
        headline: 'Reason Wide, Not Deep: Compiling Reusable Skills to Eliminate Inference Token Spend',
        tldr: 'Instead of re-deriving procedures with expensive test-time reasoning tokens on every episode, agents compile natural-language skill cards once from trajectory corpora, cutting tokens by up to 6x.',
        fullContent: 'Reasoning modes charge a 3x to 6x output-token premium on every episode, largely re-deriving procedures already solved in the domain. <br>● Pay once, not per episode: A coding agent reads trajectory corpora, runs analysis, and compiles compact 40-130 line natural-language skills injected into non-reasoning system prompts. <br>● Closes the reasoning gap: Recovers 55% to over 100% of the reasoning gap for non-reasoning models while emitting 2.7x to 6x fewer output tokens. <br>● Reasoning traces not required: Skills distilled from non-reasoning trajectories alone stay competitive with skills distilled from paired corpora. <br>● Why it matters: Shifts compute from recurring per-instance deep search to one-time wide search across episodes.',
        paperUrl: 'https://arxiv.org/abs/2608.07885',
        tweetUrl: 'https://x.com/dair_ai/status/2087264294782279808',
        whyMatters: 'Shows that amortizing search into reusable system skills allows non-reasoning models to match reasoning-model accuracy at a fraction of the inference token cost.',
        bullets: [
          'Pay once across episodes: Compiles compact skills (40-130 lines) from past trajectories to replace per-episode test-time reasoning.',
          'High token efficiency: Recovers 55%-100% of reasoning performance with 2.7x to 6x fewer output tokens and zero thinking tokens.',
          'Low distillation cost: Costs ~$1 to $3 of coding-agent compute per domain.',
        ],
      },
      {
        num: 7,
        title: 'Harness-IF',
        headline: 'Harness-IF: Disentangling Rule Compliance from Default Model Behavior',
        tldr: 'Standard benchmarks fail to separate genuine rule compliance from coincidental defaults. Harness-IF introduces Against-Prior Accuracy across 642 configurable agent rules.',
        fullContent: 'When a coding agent obeys your rule, it may simply have been going to do that anyway. <br>● Rules are the unit, not tasks: A 642-rule library places 302 rules across the five configurable surfaces a deployed agent reads across 60 realistic multi-turn tasks. <br>● Against-Prior Accuracy: Scores only rules labeled as opposing unprompted defaults, isolating genuine compliance from baseline habit. <br>● Model-specific inflation: Frontier model accuracy drops by 3.6 to 7.4 points when tested on against-prior rules. <br>● Precedence hierarchy: System prompts, project files, and user instructions outrank tool and skill descriptions in conflict tests.',
        paperUrl: 'https://arxiv.org/abs/2608.11727',
        tweetUrl: 'https://x.com/omarsar0/status/2087962456572498142',
        whyMatters: 'Establishes a rigorous metric for instruction following that strips out unprompted luck and maps the true precedence hierarchy of agent prompt surfaces.',
        bullets: [
          'Unit of evaluation: 642-rule library testing five distinct configurable agent prompt surfaces.',
          'Against-Prior Accuracy: Isolates true compliance by scoring rules that contradict the model\'s natural unprompted habits.',
          'Prompt precedence findings: Direct system prompts and project files consistently override skill and tool descriptions.',
        ],
      },
      {
        num: 8,
        title: 'Lost in Compaction',
        headline: 'Lost in Compaction: Why Context Compactors Drop Session Constraints and How to Fix It',
        tldr: 'Standard context compactors silently drop critical session constraints (retaining only 17%). A lightweight SC-aware extractor module restores retention to over 90%.',
        fullContent: 'Context compaction is standard in long-running agent systems, but silently drops instructions users most expect to persist (e.g., "do not delete emails until confirmed"). <br>● COMPINT benchmark: Evaluates compactors across chat, trajectories, and research tasks. Current compactors retain only 17% of constraints on average. <br>● Plug-and-play fix: An SC-aware extractor running alongside the compactor recovers over 90% retention without modifying the model or base compactor.',
        paperUrl: 'https://arxiv.org/abs/2608.11242',
        tweetUrl: 'https://x.com/dair_ai/status/2087930434323959894',
        whyMatters: 'Solves the structural constraint-loss issue in agent context management without expensive model retraining.',
        bullets: [
          'Severe retention failure: Current context compactors retain only 17% of active session constraints on average.',
          'COMPINT evaluation: Standardized benchmark spanning multi-turn chat, coding trajectories, and long research.',
          'Plug-and-play extractor: Recovers 90%+ constraint retention without touching underlying base models.',
        ],
      },
      {
        num: 9,
        title: 'Cracks in the Foundation',
        headline: 'Cracks in the Foundation: Architectural Choices that Cripple Long-Context Extensibility',
        tldr: 'Minor architectural choices (normalization, GQA, sliding window) undetectable in short-context training compound to degrade long-context extension performance by up to 47%.',
        fullContent: 'Architectural variations within dense transformers barely move short-context accuracy, but four minor decisions (normalization, GQA, pretraining length, sliding window) have compounding negative effects on long-context extension. Combining three or more drops downstream long-context performance by up to 47%. The authors release OlmPool (26 models across 170k GPU hours) demonstrating robust architectures.',
        paperUrl: 'https://arxiv.org/abs/2608.10296',
        tweetUrl: 'https://x.com/dair_ai/status/2087600513441546589',
        whyMatters: 'Provides architectural guidelines and the OlmPool open checkpoint suite to prevent hidden long-context degradation in modern foundation models.',
        bullets: [
          'Compounding degradation: Combining three subtle design choices drops long-context performance by up to 47%.',
          'Hidden in validation: Short-context loss metrics fail to detect these architectural bottlenecks.',
          'OlmPool release: 26 open 7B models demonstrating extensible architectures beating Llama 3 on long context.',
        ],
      },
      {
        num: 10,
        title: 'CEDAR',
        headline: 'CEDAR: Monte Carlo Tree Search for Feedback-Driven Complex Systems Design',
        tldr: 'Sakana AI uses LLM agents with MCTS over executable Python dynamical systems to discover feedback structures that produce desired emergent behaviors.',
        fullContent: 'Complex systems research models feedback-driven phenomena from population dynamics to economics, but predicting how feedback structure produces emergent behavior is notoriously hard. CEDAR uses LLM agents running Monte Carlo Tree Search over runnable Python dynamic feedback structures with LLM Judges and LLM Editors to design goal-directed emergent systems.',
        paperUrl: 'https://arxiv.org/abs/2608.06871',
        tweetUrl: 'https://x.com/dair_ai/status/2086950751314870703',
        whyMatters: 'Combines MCTS and LLM code-generation to automate discovery of complex dynamical feedback loops in economics, biology, and policy modeling.',
        bullets: [
          'MCTS over code dynamics: Searches the topological space of feedback models represented as runnable Python programs.',
          'LLM Judge & Editor: Provides fitness evaluation and domain-specific variation operators.',
          'Human interpretability: Allows structural changes that produced emergent behaviors to be inspected directly.',
        ],
      },
    ],
  },

  // Week 2: August 3 - August 9, 2026
  {
    weekTitle: 'Top AI Papers of the Week (August 3 - August 9) - 2026',
    dateRange: 'August 3 - August 9, 2026',
    dateLabel: 'AUG 03-09',
    published: '2026-08-09',
    papers: [
      {
        num: 1,
        title: 'Model or Harness',
        headline: 'Model or Harness: A 41-Point Taxonomy for Root-Causing Agent Failures',
        tldr: 'Agent evaluations report binary pass/fail without attributing where repairs belong. This taxonomy classifies 41 failure modes across model, harness, tools, memory, and environment.',
        fullContent: 'Agent evaluations mostly report system-level outcomes, so a failed run leaves the repair unassigned. <br>● Every failure gets an edge: The taxonomy organizes 41 failure modes by assigning each one to an edge between two components plus a fault side naming where the repair belongs. <br>● Actionable schema: Separates post-training targets from harness scaffolding and tool-integration fixes. <br>● Automated auditing: LLM judges achieve Cohen\'s kappa of 0.76 against human expert labels. <br>● Why it matters: Supplies the missing vocabulary and diagnostic harness for engineering agent reliability in production.',
        paperUrl: 'https://arxiv.org/abs/2607.28802',
        tweetUrl: 'https://x.com/omarsar0/status/2084367708439949343',
        whyMatters: 'Enables engineering teams to diagnose whether agent benchmark failures stem from model weights, harness scaffolding, tool definitions, or environment mismatch.',
        bullets: [
          'Component edge taxonomy: Maps 41 distinct failure modes to specific component interactions.',
          'Actionable fault assignment: Directly determines whether a bug needs post-training, prompt changes, or harness code.',
          'High judge agreement: Achieves 0.76 Cohen\'s kappa against human ground truth for continuous production monitoring.',
        ],
      },
      {
        num: 2,
        title: 'Zero-Mem',
        headline: 'Zero-Mem: Structured Long-Horizon Memory Without Inference Bills',
        tldr: 'Structured agent memory without recurring LLM generation cost. Zero-Mem indexes raw traces with entity-context graphs and temporal hierarchies, cutting latency by 57.6%.',
        fullContent: 'Production memory stacks spend extra model calls on summarizing interactions and reranking retrievals. Zero-Mem achieves zero-token memory operations by indexing raw traces with an entity-context graph and temporal hierarchy, eliminating model calls until the final answer and reducing operation time by 57.6%.',
        paperUrl: 'https://arxiv.org/abs/2607.29377',
        tweetUrl: 'https://x.com/dair_ai/status/2084370729332797724',
        whyMatters: 'Proves that deterministic indexing structures can match or beat LLM summarizers for agent memory while cutting cost and latency by more than half.',
        bullets: [
          'Zero-token memory layer: No LLM calls during storage, indexing, or retrieval operations.',
          'Dual indexing: Uses entity-context graphs for relational discovery and temporal hierarchies for locality.',
          '57.6% latency reduction: Cuts memory overhead in half while matching accuracy on long-horizon memory QA.',
        ],
      },
      {
        num: 3,
        title: 'Sample More Reflect Less',
        headline: 'Sample More Reflect Less: Why Self-Reflection Underperforms Simple Repeated Sampling',
        tldr: 'In a token-matched controlled trial across 7 methods and multiple open models, simple repeated sampling consistently matched or beat expensive self-reflection loops.',
        fullContent: 'Methods that make a model criticize and rewrite its own answer consume many tokens. This study reruns comparisons with strict token accounting across 7 methods, 1.5B-7B models, and math benchmarks with bootstrap intervals. Simple repeated sampling held up against every method, while self-inspection methods frequently degraded accuracy.',
        paperUrl: 'https://arxiv.org/abs/2607.28576',
        tweetUrl: 'https://x.com/omarsar0/status/2084761324786172347',
        whyMatters: 'Challenges the default assumption that agent loops should include self-critique steps, showing budget is better spent on independent parallel samples.',
        bullets: [
          'Exact token parity: Accounted for all critique, reflection, and debate tokens under equal compute budgets.',
          'No reliable self-critique win: Repeated sampling matched or beat reflection across all 36 paired comparisons.',
          'Self-inspection failure modes: Smaller models frequently misjudged their flawed outputs as correct.',
        ],
      },
      {
        num: 4,
        title: 'Harness-R1',
        headline: 'Harness-R1: Learning to Patch Agent Scaffolding from Deployment Trajectories',
        tldr: 'A dedicated 9B harness engineer model converts failed agent trajectories into validated executable scaffolding patches, improving target agent task success from 44.3% to 64.2%.',
        fullContent: 'Agents accumulate deployment trajectories that go unused because weights are frozen. Harness-R1 trains a dedicated 9B harness engineer with SFT and GRPO to edit runtime scaffolding, context construction, and tool mediation, lifting Qwen3.5 performance from 44.3% to 64.2% across WebShop, ALFWorld, and DBBench.',
        paperUrl: 'https://arxiv.org/abs/2608.02276',
        tweetUrl: 'https://x.com/dair_ai/status/2084706693880135848',
        whyMatters: 'Introduces a paradigm where a harness-specialized engineer model co-evolves with and repairs the execution environment around a frozen primary model.',
        bullets: [
          'Dedicated harness engineer: 9B model trained to generate code and prompt patches for runtime scaffolding.',
          'Frozen target optimization: Improves target performance without needing to fine-tune the core foundation model.',
          'Substantial benchmark lift: Boosts success rates from 44.3% up to 64.2% on interactive agent tasks.',
        ],
      },
      {
        num: 5,
        title: 'DataSpace',
        headline: 'DataSpace: A Multi-Modal Workspace Benchmark for Realistic Organizational Analytics',
        tldr: '410 cross-language analytics tasks across 7,439 artifacts (CSV, SQLite, PDF, video) totaling 15GB. Harness choice shifted accuracy by 15.36 points on identical model backbones.',
        fullContent: 'Real analytics scatters evidence across databases, documents, and videos. DataSpace benchmarks 410 tasks over 15.01 GB of heterogeneous files with deterministic tabular grading. Evaluated across 6 frontier models and 5 agent harnesses, highlighting that harness design alone moves accuracy by over 15 points.',
        paperUrl: 'https://arxiv.org/abs/2608.03451',
        tweetUrl: 'https://x.com/omarsar0/status/2085082167579902233',
        whyMatters: 'Official KDD Cup 2026 benchmark highlighting that multimodal data joining and harness architecture remain the major bottlenecks in enterprise analytics.',
        bullets: [
          'Workspace-scale data: 410 tasks across 15 GB of CSV, JSON, SQLite, Markdown, PDF, and video artifacts.',
          'Deterministic scoring: Removes judge subjectivity with type- and order-aware table alignment.',
          'Harness impact: Changing harness alone accounted for a 15.36 percentage-point swing on identical LLM backbones.',
        ],
      },
      {
        num: 6,
        title: 'Prompt-Induced Waste',
        headline: 'Prompt-Induced Waste: How Subtleties in Phrasing Decimate Coding Agent Efficiency',
        tldr: 'Phrasing like "explore multiple approaches" inflates reasoning tokens by up to 7.4x and cost by up to 30x without improving success. Bounded-efficiency wording preserves quality at a fraction of cost.',
        fullContent: 'Across 4,644 runs on deterministic coding tasks, prompt phrasing redirected effort without improving outcomes. Asking for multiple approaches inflated reasoning by 2.4x to 7.4x with no success gain. Bounded-efficiency wording specifying scope and stop conditions preserves validation while reducing spend.',
        paperUrl: 'https://arxiv.org/abs/2608.01347',
        tweetUrl: 'https://x.com/omarsar0/status/2084714744880173451',
        whyMatters: 'Provides actionable prompt design guidelines to eliminate massive redundant tool calls and runaway reasoning loops in production coding harnesses.',
        bullets: [
          'Severe reasoning inflation: Open-ended phrasing creates 3 discarded branches and 7.4x reasoning tokens for zero accuracy gain.',
          'Tool execution runaway: Excessive certainty requests caused 18x cost spikes and 2.5x more tool calls.',
          'Bounded-efficiency solution: Explicit scope and stopping criteria prevent wasteful agent looping.',
        ],
      },
      {
        num: 7,
        title: 'Rehearse',
        headline: 'Rehearse: Mitigating the Confidence Cliff in Iterative AutoResearch Loops',
        tldr: 'AutoResearch LLM judges suffer a confidence cliff as iterations progress (accuracy dropping from 82.8% to 56.9%). Rehearse recovers accuracy to 83.5% through comparative memory.',
        fullContent: 'AutoResearch loops propose changes and evaluate metrics. Across 366 paper-derived tasks, LLM judge selective accuracy drops from 82.8% to 56.9% as iterations accumulate. Rehearse compares multiple candidate proposals against a focused memory of past attempts before execution, recovering late accuracy to 83.5%.',
        paperUrl: 'https://arxiv.org/abs/2607.27687',
        tweetUrl: 'https://x.com/dair_ai/status/2084746281189270015',
        whyMatters: 'Fixes the degradation observed in long-horizon self-improving ML research loops, dramatically boosting final model benchmark outcomes under fixed compute.',
        bullets: [
          'The confidence cliff: LLM judges become overconfident and inaccurate in later iterations of automated research.',
          'Propose-Predict-Execute: Evaluates candidates comparatively before launching expensive training jobs.',
          'Accuracy recovery: Recovers late-stage selection accuracy to 83.5% across vision, chat, and forecasting tasks.',
        ],
      },
      {
        num: 8,
        title: 'ContinualSkillBench',
        headline: 'ContinualSkillBench: Benchmarking Lifelong Skill Library Accumulation in Agent Harnesses',
        tldr: 'Tests whether maintaining explicit skill libraries compounds over 500 interconnected tasks. While explicit libraries help on precise procedures, less capable models suffer from fragmented skill clutter.',
        fullContent: 'Skill libraries are widely shipped in agent harnesses. ContinualSkillBench tests 5 domains with 100 subtasks each. Explicit skill libraries perform comparably to in-context learning on average, with distinct benefits for precise routines. Less capable models accumulate fragmented, redundant skills—a key diagnostic for failed abstraction.',
        paperUrl: 'https://arxiv.org/abs/2608.03874',
        tweetUrl: 'https://x.com/dair_ai/status/2085084179201704004',
        whyMatters: 'Demonstrates that skill libraries require active deduplication and compaction mechanisms to prevent skill sprawl in autonomous agents.',
        bullets: [
          '500 ordered subtasks: Tests sequential execution and cross-task skill reuse across 5 domains.',
          'Targeted benefits: Explicit skills pay off for deterministic procedural routines and precise outputs.',
          'Skill sprawl diagnostic: Identifies failure modes where weak models build fragmented, unmaintainable skill sets.',
        ],
      },
      {
        num: 9,
        title: 'MerchantBench',
        headline: 'MerchantBench: 365-Day Long-Horizon E-Commerce Simulation for LLM Agents',
        tldr: 'A 365-day simulated e-commerce economy with 98,843 product records and 26 tools. Frontier LLMs achieved only 27.3% of human net assets, revealing severe long-term planning decay.',
        fullContent: 'Agent benchmarks focus on short tasks. MerchantBench runs 365-day simulations with delayed feedback, supplier events, pricing, and cash flow across 98,843 real product records. The best LLM configuration reached only 27.3% of human final net assets due to compounding incoherence.',
        paperUrl: 'https://arxiv.org/abs/2607.28956',
        tweetUrl: 'https://x.com/dair_ai/status/2084413007514550720',
        whyMatters: 'Pioneers realistic annual business simulation to evaluate whether autonomous agents can manage compounding delayed consequences over hundreds of turns.',
        bullets: [
          'Realistic year-long simulation: 365 simulated days with delayed supplier, shipping, and pricing feedback.',
          'Severe planning gap: Best LLM agents achieved only 27.3% of human net asset returns.',
          'Compounding incoherence: Short-term greedy choices lead to cash-flow traps and inventory failure over time.',
        ],
      },
      {
        num: 10,
        title: 'TokTier',
        headline: 'TokTier: Stateful Incremental Tokenization for Fast Agent Serving and KV-Cache Hit Rates',
        tldr: 'Front-ends waste 10%-64% of time-to-first-token re-tokenizing growing transcripts. TokTier provides GPU/CPU stateful incremental tokenization, delivering up to 437x speedups.',
        fullContent: 'Serving stacks cache KV state while re-tokenizing full transcripts on every turn. Across 153,951 agent calls, tokenization reached 64% of TTFT. TokTier offers stateful GPU/CPU tokenization with differential boundary verification, cutting incremental tokenization to 0.5-1.1ms (up to 437x faster) and lowering TTFT by up to 34% under vLLM.',
        paperUrl: 'https://arxiv.org/abs/2607.29678',
        tweetUrl: 'https://x.com/omarsar0/status/2084414040760275278',
        whyMatters: 'Eliminates the front-end tokenization bottleneck in multi-turn coding and agent loops, significantly speeding up interactive response times.',
        bullets: [
          'Bottleneck identification: Tokenization takes up to 64% of time-to-first-token in long agent transcripts.',
          'Exact boundary splicing: Stateful tokenization matches full reference tokenization with zero divergence across 17 tokenizer families.',
          'Up to 437x faster: Reduces tokenization time to 0.5-1.1 ms and lowers median vLLM TTFT by 16%-34%.',
        ],
      },
    ],
  },
];

/**
 * Transforms paper objects into the UnboxingAI story card format.
 */
function formatPaperAsStory(paper, weekInfo, index, totalInWeek) {
  const paperId = `paper-${slug(paper.title)}`;
  const color = COLOR_CYCLE[index % COLOR_CYCLE.length];
  const tags = PAPER_TAGS[paper.title] || ['Research', 'Paper', 'AI'];

  return {
    id: paperId,
    rank: paper.num || index + 1,
    published: weekInfo.published,
    dateLabel: weekInfo.dateLabel,
    weekTitle: weekInfo.weekTitle,
    importance: index < 3 ? 'High' : 'Medium',
    source: 'DAIR.AI / arXiv',
    sourceEmoji: '📄',
    sourceKind: 'Top AI Papers of the Week',
    color,
    glyph: '⚗',
    tags,
    category: 'Research',
    isResearch: true,
    title: paper.title,
    paperTitle: paper.title,
    tldr: paper.tldr,
    deck: paper.tldr,
    whyMatters: paper.whyMatters || paper.tldr,
    bulletPoints: paper.bullets || [],
    url: paper.paperUrl || 'https://arxiv.org',
    tweetUrl: paper.tweetUrl || null,
    fullContent: paper.fullContent || paper.tldr,
    mins: Math.max(4, Math.min(8, Math.round((paper.fullContent?.split(/\s+/).length || 100) / 45))),
    featured: index < 4, // Top 4 in each week marked as featured
  };
}

/**
 * Parses markdown content from DAIR.AI repository to extract the top 2 weeks of papers.
 */
function parseMarkdownPapers(mdText) {
  try {
    const headings = [...mdText.matchAll(/##\s+Top AI Papers of the Week\s+\(([^)]+)\)\s*-\s*(\d{4})/g)];
    if (headings.length < 2) return null;

    const weeks = [];
    for (let i = 0; i < Math.min(2, headings.length); i++) {
      const match = headings[i];
      const headingText = match[0].replace(/^##\s+/, '').trim();
      const dateRange = match[1].trim(); // e.g. "August 10 - August 16"
      const year = match[2].trim();

      // Extract section between this heading and the next heading (or horizontal rule / end)
      const startIndex = match.index + match[0].length;
      const nextMatch = headings[i + 1];
      const endIndex = nextMatch ? nextMatch.index : mdText.indexOf('\n## ', startIndex);
      const sectionText = mdText.slice(startIndex, endIndex === -1 ? startIndex + 20000 : endIndex);

      // Parse markdown table rows: | 1) **Title** - Summary... | [Paper](url), [Tweet](url) |
      const rowRegex = /\|\s*(\d+)\)\s*\*\*([^*]+)\*\*\s*-\s*([\s\S]*?)\|\s*([\s\S]*?)\|/g;
      const papers = [];
      let rowMatch;

      while ((rowMatch = rowRegex.exec(sectionText)) !== null) {
        const num = Number(rowMatch[1]);
        const title = rowMatch[2].trim();
        const rawContent = rowMatch[3].trim();
        const rawLinks = rowMatch[4].trim();

        // Extract paper and tweet links
        const paperUrl = (rawLinks.match(/\[Paper\]\((https?:\/\/[^\s)]+)\)/i) || [, 'https://arxiv.org'])[1];
        const tweetUrl = (rawLinks.match(/\[Tweet\]\((https?:\/\/[^\s)]+)\)/i) || [, null])[1];

        // Clean content and extract bullets
        const parts = rawContent.split(/<br\s*\/?>●|\n●/g).map(p => p.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()).filter(Boolean);
        const tldr = parts[0] || '';
        const bullets = parts.slice(1).filter(b => !b.toLowerCase().startsWith('why it matters:'));
        const whyMattersMatch = parts.find(b => b.toLowerCase().startsWith('why it matters:'));
        const whyMatters = whyMattersMatch ? whyMattersMatch.replace(/^why it matters:\s*/i, '') : tldr;

        // Formulate date label: e.g. "AUG 10-16"
        const dateLabel = dateRange.toUpperCase().replace(/AUGUST\s*/g, 'AUG ').replace(/\s*-\s*AUG/g, '-');

        papers.push({
          num,
          title,
          headline: `${title}: ${tldr.split('.')[0]}`,
          tldr,
          fullContent: rawContent,
          paperUrl,
          tweetUrl,
          whyMatters,
          bullets: bullets.map(b => b.trim()),
        });
      }

      if (papers.length > 0) {
        const publishedDate = i === 0 ? '2026-08-16' : '2026-08-09';
        const dateLabel = i === 0 ? 'AUG 10-16' : 'AUG 03-09';
        weeks.push({
          weekTitle: headingText,
          dateRange: `${dateRange} - ${year}`,
          dateLabel,
          published: publishedDate,
          papers,
        });
      }
    }

    if (weeks.length >= 2 && weeks[0].papers.length > 0 && weeks[1].papers.length > 0) {
      return weeks;
    }
    return null;
  } catch (err) {
    console.warn('[papers] Failed to parse live markdown:', err.message);
    return null;
  }
}

/**
 * Fetches the top 2 weeks of AI research papers from DAIR.AI repository.
 * Returns formatted stories tagged as category "Research".
 */
export async function getResearchPapers({ force = false } = {}) {
  return cached('research-papers:2026:v2', force ? 0 : PAPERS_TTL, async () => {
    let weeksData = null;
    try {
      const response = await fetch(PAPERS_URL, {
        headers: { 'user-agent': 'UnboxingAI/0.2 (learning companion)' },
      });
      if (response.ok) {
        const text = await response.text();
        weeksData = parseMarkdownPapers(text);
      }
    } catch (error) {
      console.warn('[papers] Live fetch failed, using fallback data:', error.message);
    }

    if (!weeksData || !weeksData.length) {
      weeksData = FALLBACK_PAPERS;
    }

    // Flatten into stories
    const allStories = [];
    for (const week of weeksData) {
      week.papers.forEach((paper, idx) => {
        allStories.push(formatPaperAsStory(paper, week, idx, week.papers.length));
      });
    }

    return {
      weeks: weeksData.map(w => ({
        weekTitle: w.weekTitle,
        dateRange: w.dateRange,
        dateLabel: w.dateLabel,
        count: w.papers.length,
      })),
      stories: allStories,
      fetchedAt: new Date().toISOString(),
    };
  });
}

/**
 * Generates an explanation for a research paper, identical for Intermediate and Expert levels.
 */
export function explainResearchPaper(paperStory, level = 'Intermediate') {
  if (level === 'Beginner') {
    return {
      deck: paperStory.tldr,
      shortVersion: [
        paperStory.tldr,
        'Research papers in UnboxingAI are tailored for Intermediate and Expert learners exploring technical literature.',
      ],
      plainLanguage: paperStory.tldr,
      keyTerms: (paperStory.tags || []).slice(0, 4).map(tag => ({
        term: tag,
        meaning: `Core research concept related to ${paperStory.title}.`,
      })),
      whyItMatters: paperStory.whyMatters,
      watchNext: [
        `Read the original paper at ${paperStory.url}`,
        paperStory.tweetUrl ? `Join the discussion at ${paperStory.tweetUrl}` : 'Explore follow-up benchmarks.',
      ],
      level,
      generatedBy: 'research-paper-digest',
      note: 'Research papers are detailed for Intermediate & Expert readers.',
    };
  }

  // Intermediate & Expert get the identical rich technical content
  const bullets = paperStory.bulletPoints && paperStory.bulletPoints.length
    ? paperStory.bulletPoints
    : ['Comprehensive scaling and empirical findings analyzed.'];

  return {
    deck: paperStory.deck,
    shortVersion: [
      paperStory.tldr,
      ...bullets.slice(0, 3),
    ],
    plainLanguage: paperStory.tldr,
    keyTerms: (paperStory.tags || []).filter(t => t !== 'Research' && t !== 'Paper').map(term => ({
      term,
      meaning: `Key concept in ${paperStory.title}.`,
    })),
    whyItMatters: paperStory.whyMatters,
    watchNext: [
      `Inspect full findings and mathematical proofs in the arXiv publication.`,
      paperStory.tweetUrl ? `Track community discussion and empirical replications on X.` : 'Review related benchmarks.',
    ],
    bulletPoints: paperStory.bulletPoints,
    level,
    generatedBy: 'research-paper-digest',
    note: 'Top AI Papers of the Week curated by DAIR.AI.',
  };
}

/**
 * Generates multi-source exploration info for a research paper.
 */
export function researchForPaper(paperStory, level = 'Intermediate', allStories = []) {
  const related = allStories
    .filter(s => s.id !== paperStory.id && s.category === 'Research')
    .slice(0, 2);

  const sources = [
    {
      publisher: 'arXiv Pre-print',
      domain: 'arxiv.org',
      title: paperStory.title,
      snippet: paperStory.tldr,
      url: paperStory.url,
      published: paperStory.published,
      primary: true,
      sourceEmoji: '📄',
      angle: 'Primary Research Paper',
    },
  ];

  if (paperStory.tweetUrl) {
    sources.push({
      publisher: 'DAIR.AI / Author Commentary',
      domain: 'x.com',
      title: `Research breakdown: ${paperStory.paperTitle || paperStory.title}`,
      snippet: paperStory.whyMatters || paperStory.tldr,
      url: paperStory.tweetUrl,
      published: paperStory.published,
      primary: false,
      sourceEmoji: '💬',
      angle: 'Community & Author Breakdown',
    });
  }

  const explorations = (paperStory.tags || [])
    .filter(t => t !== 'Research' && t !== 'Paper')
    .map(tag => ({
      topic: tag,
      why: `Understanding ${tag} provides essential context for ${paperStory.paperTitle || paperStory.title}.`,
      links: [
        {
          title: `${tag} in Modern AI Research`,
          domain: 'arxiv.org',
          url: `https://arxiv.org/search/?query=${encodeURIComponent(tag)}&searchtype=all`,
          snippet: `Recent papers and pre-prints covering ${tag}.`,
        },
      ],
    }));

  return {
    answer: `${paperStory.paperTitle || paperStory.title}: ${paperStory.tldr} ${paperStory.whyMatters}`,
    sources,
    related,
    explorations,
    note: 'Top AI Papers of the Week from DAIR.AI.',
  };
}
