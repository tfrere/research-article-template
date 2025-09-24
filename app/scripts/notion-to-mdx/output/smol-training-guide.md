

## Introduction

What does it actually take to train a performant LLM today?

Published research makes it look straightforward: strategic architecture choices, carefully curated datasets, and sufficient compute. The results are polished, the ablations are structured and clean. Every decision seems obvious in hindsight. But these technical reports only show what worked and apply a bit of rosy retrospection – they don't capture the 2am dataloader debugging sessions, the loss spikes, or the subtle tensor parallelism bug (see later!) that quietly sabotages your training. The reality is messier, more iterative, and full of decisions that don't make it into the final technical report.

Join us as we look behind the scenes of training SmolLM3, a 3B multilingual reasoning model trained on 11T tokens. This is not an ordinary blog post but rather the untangling of a spiderweb of decisions, discoveries, and dead ends that led to deep insights into what it takes to build world-class language models.

It is also the finale of the training opus: we've worked through building datasets at scale ([FineWeb](https://huggingface.co/spaces/HuggingFaceFW/blogpost-fineweb-v1)), orchestrating thousands of GPUs to sing in unison ([Ultra Scale Playbook](https://huggingface.co/spaces/nanotron/ultrascale-playbook)), and selecting the best evaluations at each step of the process ([Evaluation Guidebook](https://github.com/huggingface/evaluation-guidebook)). Now we put it all together to train a strong model. We'll walk you through the complete pipeline – not just the final recipe that worked, but the failed experiments, infrastructure breakdowns, and debugging processes that shaped our decisions.

The story reads like a drama: You'll see how promising small-scale ablations sometimes don't translate at scale, why we restarted the training after 1T tokens, how we balanced multilinguality, math, and code while maintaining strong English performance, and finally how we trained a hybrid reasoning model.

Think of this as a guide for anyone trying to go from "we have a great dataset and GPUs" to "we built a really strong model". We hope it helps close the gap between research and production, and makes your next training run a little less chaotic.

So where do we even start? Settle on the architecture? Experiment with data mixes? Tune the hyperparameters? All these choices interact in subtle ways.  **First, we need to set a training compass.** 

### Training Compass: Why → What → How 

Before you start training, clarify three things:

1.  **Why train this model?** Are you aiming for a research milestone, a production system, or simply hands-on experience?
1.  **What should this model be good at?** English, multilinguality, code, long context, efficiency, or something else?
1.  **How will you get there?** That’s what this guide covers: turning purpose into a plan, and a plan into a training pipeline.
The  *why*  and  *what*  are unique to your goals, so we can’t answer them for you. The  *how*  is where this blog steps in. We’ll show you how to:

-  **Identify what’s worth testing**  (and what isn’t).
-  **Design experiments that give real signal**  instead of noise.
-  **Choose infrastructure and frameworks**  that won’t collapse mid-run.
-  **Track metrics and build guardrails**  so the training is smooth.
With this compass in place, we can start small and build up systematically. (We’ll detail our own process below in a bit!) 

![Image](/media/27877f1c9c9d804d9c82f7b3905578ff/image_27877f1c-9c9d-804d-bd0a-e0b1c15e504f.png)

## Building a strong foundation: ablations

Before we can start training an LLM, we need to make many decisions that will shape the model's performance and training efficiency. How big should the model be, and for how long should you train it? Which architecture will best serve your use case? What optimizer and learning rate schedule to use and which data sources to mix in?

How these decisions are made is a frequently asked question and people sometimes expect that they are made by thinking deeply about them. The truth is quite different: of course you can hypothesize what can and cannot work, unfortunately things are not always intuitive with LLM. 

For example, using what we think is “the highest quality data possible” might… actually not translate to stronger models. A common example is Arxiv, a platform that gathers all of humanity’s cutting edge knowledge: clearly, training on this marvel of data will lead to the strongest STEM models, right? Well, actually, not at all - small models especially do not benefit from this, it can even hurt their performance ([Shao et al., 2024](https://arxiv.org/abs/2402.03300)). Why? Though Arxiv papers contain a lot of knowledge, it is quite compressed, and doesn’t include the kind of reasoning we look for. 

So, how can we know what works if staring at the problem long and hard doesn’t help? We run a lot of experiments, like good empiricists! Machine learning is not pure math, but actually very much an experimental science.

Since those experiments will guide many of our crucial decisions, it is really important to set them up well. There are essentially two main attributes we want from them. First, they should run as fast as possible since we want to iterate many times. The more ablations we can run, the more questions and hypotheses we can answer. Second, they should give reliable performance signals. If the metrics we look at don't differ much early on we might not see anything in the ablations, or if they are a bit noisy we might start interpreting just noise. We discussed this already in [FineWeb blog](https://huggingface.co/spaces/HuggingFaceFW/blogpost-fineweb-v1).

> [ASIDE]: In preparation of [StarCoder2](https://huggingface.co/collections/bigcode/starcoder2-65de6da6e87db3383572be1a), we ran ablations on pretraining context length and got very inconsistent results (like 2k is good, 4k is bad, 8k is good). It turned out the HumanEval benchmark we were relying on had significant noise and we were looking at just that.

Let’s build a simple ablation setup we can use for our experiments. First, we need to decide which training framework to pick.

### Picking a Training Framework

The first decision we need to make is which framework to use for training our model, and by extension, for running all our ablations. This choice involves balancing three key considerations that, frustratingly, will work against each other.

First, we need a framework that supports the architecture we want to experiment with, or one where we're comfortable implementing new features ourselves. Second, we need something battle-tested and production-ready that won't mysteriously break during long training runs. Third, we want good throughput so our experiments actually run quickly and we can iterate faster.

The tension becomes clear when we look at the options. [Megatron-LM](https://github.com/NVIDIA/Megatron-LM) from Nvidia has been around for years and is battle-tested. It's what powers models like Kimi's K2 ([Team, Kimi, et al., 2025](https://arxiv.org/abs/2507.20534)), and it delivers solid throughput and has most of the production features we'd want. But that maturity comes with complexity: the codebase can be hard to navigate and modify when we need to implement something new.

[DeepSpeed](https://github.com/deepspeedai/DeepSpeed) falls into a similar category, it's the pioneer of ZeRO optimization and powered models like BLOOM and GLM. Like Megatron-LM, it's extensively battle-tested and optimized, but shares the same complexity challenges. The large codebase (194k total lines) can be intimidating when you need to implement custom features or debug unexpected behavior.

On the other side, PyTorch's recent [TorchTitan](https://github.com/pytorch/torchtitan) library is much lighter and simpler to navigate, thanks to its compact and modular codebase. It has the core features needed for pretraining and is great for rapid experimentation. However, being newer, it isn’t as battle-tested and can still be a bit unstable as it’s actively developed.

We took a different approach and decided to build [nanotron](https://github.com/huggingface/nanotron/), our own framework, from scratch a few years ago. This gave us maximum flexibility and deep understanding of large-scale pretraining (which eventually became our Ultra Scale playbook). Having an internal framework means we have the people who built it available for support, and we understand every component. Since we open-sourced the library, we also got valuable feedback from the community, though for most cases we had to battle-test features ourselves first. The framework now supports all the production features we need for training, but we're still building out areas like MoE support.

Ultimately, your choice depends on your team's expertise, target features, and how much time you're willing to invest in development versus using the most production-ready option. 

If multiple frameworks support your needs, compare their throughput on your specific hardware. For quick experiments and speed runs, simpler codebases often win.

![Image](/media/27877f1c9c9d804d9c82f7b3905578ff/image_27877f1c-9c9d-8014-834f-d700b623256b.png)

(Table inspired from Table 8 in in [TorchTitan technical report](https://arxiv.org/pdf/2410.06511v3))

![Image](/media/27877f1c9c9d804d9c82f7b3905578ff/image_27877f1c-9c9d-80b6-be07-e8646502f82a.png)

### Ablation setup

#### Setting up our ablation framework

Now that we've chosen a framework, we need to decide on our ablation setup. Remember, the goal is to run experiments at a small scale and get results we can confidently extrapolate to our final production run.

There are two main approaches. First, we can take our target model and train it on fewer tokens. For SmolLM3 ablations, we trained the full 3B model on 100B tokens instead of the final 11T. Second, if our target model is too large, we can train a smaller proxy model for ablations. For example, when Kimi was developing their 1T parameter Kimi K2 model with 32B active parameters, using the full size for all ablations would have been prohibitively expensive, so they ran some ablations on a 3B MoE with 0.5B active parameters (Team, Kimi, et al., 2025).

The key question is whether these small-scale findings actually transfer. Here's what we've learned: if something hurts performance at small scale, we can confidently rule it out for large scale. If something works at small scale and we’ve trained on a reasonable number of tokens, there's a high chance these findings will extrapolate. The longer we train and the closer our ablation models are to the final model, the better.

> [NOTE]: When scaling experiments, changing the number of nodes or parallelism configuration should not affect training correctness. So we can use a different parallelism configuration for the ablations.

For this blog, we'll use a baseline vanilla transformer for all ablations. Our main setup is a 1B transformer following [Llama3.2 1B](https://huggingface.co/meta-llama/Llama-3.2-1B) architecture trained on 45B tokens, which takes about 1.5 days on 8xH100 using this nanotron [config](https://huggingface.co/datasets/HuggingFaceTB/ablations-training-configs/blob/main/baseline_config.yaml) (42k tokens per second per GPU). For experiments needing stronger signal, we'll also show results from our larger setup: the 3B model trained on 100B tokens that we used for SmolLM3. You can find the 3B baseline config [here](https://huggingface.co/datasets/HuggingFaceTB/ablations-training-configs/blob/main/baseline_config_3B.yaml).

Our baseline 1B config captures all the essential training details in a structured YAML format. Here are the key sections:

```yaml
## Datasets and mixing weights
data_stages:
- data:
    dataset:
      dataset_folder:
      - fineweb-edu
      - stack-edu-python
      - finemath-3plus
      dataset_weights:
      - 0.7
      - 0.2
      - 0.1

## Model architecture, Llama3.2 1B configuration
model:
  model_config:
    hidden_size: 2048
    num_hidden_layers: 16
    num_attention_heads: 32
    num_key_value_heads: 8  
    intermediate_size: 8192
    max_position_embeddings: 4096
    rope_theta: 50000.0
    tie_word_embeddings: true

## Training hyperparameters, AdamW with cosine schedule
optimizer:
  clip_grad: 1.0
  learning_rate_scheduler:
    learning_rate: 0.0005
    lr_decay_starting_step: 2000
    lr_decay_steps: 18000
    lr_decay_style: cosine
    lr_warmup_steps: 2000
    lr_warmup_style: linear
    min_decay_lr: 5.0e-05
  optimizer_factory:
    adam_beta1: 0.9
    adam_beta2: 0.95
    adam_eps: 1.0e-08
    name: adamW

## Parallelism, 1 node
parallelism:
  dp: 8  # Data parallel across 8 GPUs
  tp: 1  # No tensor or pipeline parallelism needed at 1B scale
  pp: 1 

## Tokenizer
tokenizer:
  tokenizer_max_length: 4096
  tokenizer_name_or_path: HuggingFaceTB/SmolLM3-3B

## Batch size, sequence length and total training for 30B tokens
tokens:
  batch_accumulation_per_replica: 16
  micro_batch_size: 3 # GBS (global batch size)=dp * batch_acc* MBS * sequence=1.5M tokens
  sequence_length: 4096
  train_steps: 20000 # GBS * 20000 = 30B
 
 ...(truncated)
```
For our ablations, we'll modify the first 3 sections while keeping everything else constant.

When running ablations, some architectural changes can significantly alter parameter count. For instance, switching from tied to untied embeddings doubles our embedding parameters, while going from MHA to GQA or MQA decreases our attention parameters substantially. To ensure fair comparisons, we need to track parameter counts and occasionally adjust other hyperparameters (like hidden size or layer count) to keep model sizes roughly the same. This simple function will helps us estimate parameter counts for different configurations:

```python
from transformers import LlamaConfig, LlamaForCausalLM

def count_parameters(
    tie_embeddings=True,
    num_key_value_heads=4,
    num_attention_heads=32,
    hidden_size=2048,
    num_hidden_layers=16,
    intermediate_size=8192,
    vocab_size=128256,
    sequence_length=4096,
):
    config = LlamaConfig(
        hidden_size=hidden_size,
        num_hidden_layers=num_hidden_layers,
        num_attention_heads=num_attention_heads,
        num_key_value_heads=num_key_value_heads,
        intermediate_size=intermediate_size,
        vocab_size=vocab_size,
        max_position_embeddings=sequence_length,
        tie_word_embeddings=tie_embeddings,
    )
    model = LlamaForCausalLM(config)  
    return f"{sum(p.numel() for p in model.parameters())/1e9:.2f}B"
```
We'll also provide an interactive tool with detailed breakdown later to visualize LLM parameter distributions.

####  **Understanding what works** 

Once we launch our ablations, how do we know what works or not? 

The first instinct of anyone who trains models might be to look at the loss, and yes, that's indeed important. For many architectural choices, the loss correlates well with downstream performance and can be sufficient ([Chen et al., 2025](https://arxiv.org/pdf/2410.08527)). However, it's not always reliable. For example, with data ablations, training on Wikipedia gives a lower loss than training on web pages (the next token is easier to predict), but that doesn't mean we'll get a more capable model. Similarly, some changes might specifically affect certain capabilities like reasoning and math, so we need more fine-grained evaluation to see the full picture and understand these nuanced effects. Additionally, models can continue improving on downstream tasks even after pretraining loss has converged ([Liu et al., 2022](https://arxiv.org/pdf/2210.14199)).

This is why we need downstream evaluations that test knowledge, understanding, reasoning, and whatever other domains matter for us. For our ablations, we focus on tasks that give good early signal and avoid noisy benchmarks. In [FineTasks](https://huggingface.co/spaces/HuggingFaceFW/blogpost-fine-tasks), reliable evaluation tasks are defined by four key principles:

-  **Monotonicity:**  The benchmark scores should consistently improve as models train longer.
-  **Low noise:**  When we train models with the same setup but different random seeds, the benchmark scores shouldn't vary wildly.
-  **Above-random performance:**  Many capabilities only emerge later in training, so tasks that show random-level performance for extended periods aren't useful for ablations. This is the case, for example, for MMLU in multiple choice format as we will explain later.
-  **Ranking consistency:**  If one approach outperforms another at early stages, this ordering should remain stable as training continues.
The quality of a task also depends on the task formulation (determining how we ask the model questions) and metric choice (for how we compute the model score).

The three common task formulations are multiple choice format (MCF), which requires models to select an option from a number of choices explicitly presented in the prompt and prefixed with A/B/C/D (as is done in MMLU, for example), cloze formulation (CF), where we compare the likelihood of the difference choices to see which one is more likely without having provided them in the prompt, and freeform generation (FG), where we look at the accuracy of the greedy generation for a given prompt. FG is too complex to be used before the end of training, as it requires the model to have acquired a lot of latent knowledge, so it is better to focus on multiple choice formulations when training (MCF or CF). 

Research has shown that models struggle with MCF early in training, only learning this skill after extensive training, making CF better for early signal ([Gu et al., 2024](https://arxiv.org/pdf/2406.08446); [Du et al., 2024](https://arxiv.org/abs/2403.15796), [Li et al. 2024](https://arxiv.org/abs/2406.11794)). So we use CF for our short ablations, and integrate MCF during the main run since it can give better signal once the model has been trained sufficiently. Finally, to score the model's answer, we use accuracy normalized by character count to prevent bias toward shorter answers.

> [ASIDE]: The point at which MMLU MCF becomes non-random depends on the model size and training data. For a 7B transformer, [Gu et al., 2024](https://arxiv.org/pdf/2406.08446) found the model starts showing non-random performance after 500B tokens. For 1.7B model, we found this happens after 6T tokens in SmolLM2.

Our ablations evaluation suite includes the benchmarks from [FineWeb](https://huggingface.co/spaces/HuggingFaceFW/blogpost-fineweb-v1) ablations, except for SIQA which we found to be noisy. We add math and code benchmarks GSM8K and HumanEval. These tasks test world knowledge, reasoning, and common sense across a variety of formats, as shown in the table below. To speed up evaluations, we only use the first 1,000 questions from each benchmark and apply CF for all multiple-choice benchmarks, as explained above.  Note that for multilingual ablations and actual training, we add more benchmarks to test multilinguality, which we will mention later.

![Image](/media/27877f1c9c9d804d9c82f7b3905578ff/image_27877f1c-9c9d-80e9-b729-dbd328930bed.png)

For architecture ablations, we train on a fixed mix of high-quality datasets that provide early signal across a wide range of tasks. We use English ([FineWeb-Edu](https://huggingface.co/datasets/HuggingFaceFW/fineweb-edu)), math ([FineMath](https://huggingface.co/datasets/HuggingFaceTB/finemath)), and code ([Stack-Edu-Python](https://huggingface.co/datasets/HuggingFaceTB/stack-edu)). Architectural findings should extrapolate well to other datasets and domains, including multilingual data so we can keep our data mixture simple. For data ablations, we take the opposite approach: we fix the architecture and systematically vary the data mixtures to understand how different data sources affect model performance.

The real value of a solid ablation setup goes beyond just building a good model. When things inevitably go wrong during our main training run (and they will, no matter how much we prepare), we want to be confident in every decision we made and quickly identify which components weren't properly tested and could be causing the issues. This preparation saves debugging time and keeps our sanity intact. There's nothing worse than staring at a mysterious training failure with no idea where the bug could be hiding.

#### Estimating ablations cost

Before diving into specific ablations, it's worth understanding the cost of these experiments approach. The table below shows our complete compute breakdown for SmolLM3 pretraining: the main run (accounting for occasional downtimes), ablations before and during training, plus compute spent on an unexpected scaling issue that forced a restart and some debugging (which we'll detail later). 

![Image](/media/27877f1c9c9d804d9c82f7b3905578ff/image_27877f1c-9c9d-8078-b6da-c7a4c67c8f35.png)

> [TODO]: add a note about post-training cost? 

> [ASIDE]: We estimate evaluation costs to be slightly under 10,000 GPU hours. Our full evaluation suite (english, multilingual, math & code) takes around 1.5 hours per GPU, and we ran evaluations every 10B tokens throughout the 11T token training run, in addition to evaluating numerous ablations. The long context evaluations were particularly expensive, taking around 1 hour on 8 GPUs per run.

The numbers reveal an important fact: ablations and debugging consumed 161,280 GPU hours, more than half the cost of our main training run (276,480 GPU hours) **.**  We run over 100 ablations total across SmolLM3’s development: we spent 20 days on pre-training ablations, 10 days on mid-training ablations, and 7 days recovering from an unexpected training issue that forced a restart and some debugging (which we'll detail later). 

This highlights why ablation costs must be factored into your compute budget: plan for training cost plus ablations plus buffer for surprises. If you're targeting SOTA performance, implementing new architecture changes, or don't already have a proven recipe, ablations become a substantial cost center rather than minor experiments.

> [ASIDE]: When [DeepSeek-V3](https://huggingface.co/deepseek-ai/DeepSeek-V3) came out, [the world fixated](https://www.forbes.com/sites/markminevich/2025/02/06/the-6-million-ai-bombshell-how-deepseek-shook-wall-street-and-ai-leadership/) on its reported $5.6M training cost. Many interpreted that number as the full R&D cost. In reality, it only reflects the final training run. The much larger — and usually invisible — expense is in the research itself: the ablations, failed runs, and debugging that lead to a final recipe. Given the scale and novelty of the model, their research costs were certainly high.

### Rules of engagement

TL;DR: Be paranoid. 

Before we move to the next section, let's establish some ground rules that every person running experiments should follow.

 **Validate your evaluation suite.** Before training any models, make sure your evaluation suite can reproduce the published results of models you will compare against. If any benchmarks are generative in nature (e.g. GSM8k), be extra paranoid and manually inspect a few samples to ensure the prompt is formatted correctly and that any post-processing is extracting the correct information. Since evals will guide every single decision, getting this step right is crucial for the success of the project!

 **Test every change, no matter how small.**  Don't underestimate the impact of that seemingly innocent library upgrade or the commit that "only changed two lines". These small changes can introduce subtle bugs or performance shifts that will contaminate your results.

 **Change one thing at a time.**  Keep everything else identical between experiments. Some changes can interact with each other in unexpected ways, so we first want to assess the individual contribution of each change, then try combining them to see their overall impact.

 **Train on enough tokens and use sufficient evaluations.**  As we mentioned earlier, we need to make sure we have good coverage in our evaluation suite and train long enough to get reliable signal. Cutting corners here will lead to noisy results and bad decisions.

Following these rules might feel overly cautious, but the alternative is spending days debugging mysterious performance drops that turn out to be caused by an unrelated dependency update from days earlier. The golden principle: once you have a good setup, no change should go untested.

## Defining your LLM

Now that we have our experimental framework in place, it's time to make the big decisions that will define our model. Every choice we make, from model size to attention mechanisms to tokenizer choice, creates constraints and opportunities that will affect model training and usage. 

Remember the  **Training Compass** : before making any technical choices, we need clarity on the  *why*  and  *what* . Why are we training this model, and what do we want it to be good at?

It sounds obvious, but being deliberate here shapes our decisions and keeps us from getting lost in the endless space of possible experiments. Are we aiming for a SOTA model in English? Is long context a priority? Are we trying to validate a new architecture? Or do we simply want to gain hands-on experience with pretraining? The training loop may look similar in all these cases, but the experiments we run and the trade-offs we accept will be different. For example, answering this question early helps us decide how to balance our time between data and architecture work, and how much to innovate in each before starting the run. 

So, let’s lead by example and walk through the goals that guided SmolLM3’s design. We wanted a strong model for on-device applications with competitive multilingual performance, solid math and coding capabilities, and robust long context handling. We had a working recipe from SmolLM2 for English at a smaller scale (1.7B parameters), but scaling up meant re-validating everything and tackling new challenges like multilinguality and extended context length. One clear example of how having defined goals shaped our approach: in SmolLM2, we struggled to extend the context length at the end of pretraining, so for SmolLM3 we made architectural choices from the start — like using NoPE and intra-document masking (see later) — to maximize our chances of getting it right, and it worked.

> [ASIDE]: SmolLM2 was our previous generation of small language models, with three variants at 135M, 360M, and 1.7B parameters designed for on-device deployment. They were English only with 8k context length. 

Once our goals are clear, we can start making the technical decisions that will bring them to life. In this chapter, we'll go through our systematic approach to these core decisions:  architecture, data, and hyperparameters. Think of this as our strategic planning phase, getting these fundamentals right will save us from costly mistakes during the actual training marathon.

### Architecture Choices

The first thing we need to decide on is the architecture to use. Should we go for a dense transformer, a hybrid model that combines attention with state space models, or a mixture of experts to get more capacity without the computational cost? Each approach involves different trade-offs between performance, efficiency, and implementation complexity.

Even after settling on the broad architecture type, we still have decisions about attention mechanisms, positional encodings, activation functions, and model layout. Then there's another important but sometimes underrated component: the tokenizer. Should we use an existing one or train our own? How do we even evaluate if our tokenizer is good?

We'll try to answer all these questions in this section.

First, we provide this tool for visualizing what makes up an LLM, which can come in handy when making architecture decisions or setting up configs for ablations.

![Image](/media/27877f1c9c9d804d9c82f7b3905578ff/image_27877f1c-9c9d-80b9-8cfb-f0a6aaaa8760.png)

[TODO]: embed [https://huggingface.co/spaces/HuggingFaceTB/llm-parameter-calculator](https://huggingface.co/spaces/HuggingFaceTB/llm-parameter-calculator)

[TODO] add an aside as a disclaimer about computation limitations 

#### The LLM Landscape (Elie/Leandro)

 **Understanding a Dense Model** 

 **Attention** 

One of the most active fields of interest around the transformer architecture is the attention mechanism. Although during pretraining the compute is mostly dominated by the chunky feedforward layers, when running inference on the model especially on long context the attention can quickly dominate the compute cost and the KV-cache can eat the GPU memory lowering the throughput. Let’s take a quick tour around the main attention mechanisms and how they trade-off capacity and speed.

 *Multi-head attention (MHA)* is the standard attention introduced with the transformer. Checkout [Jay Alamar’s famous blog](https://jalammar.github.io/illustrated-transformer/) post for a quick refresher! 

![Image](/media/27877f1c9c9d804d9c82f7b3905578ff/image_27877f1c-9c9d-808f-b712-c7c608da3fc6.png)

![From DeeppSeek v2 [https://arxiv.org/pdf/2405.04434#page=6.17](https://arxiv.org/pdf/2405.04434#page=6.17)](/media/27877f1c9c9d804d9c82f7b3905578ff/image_27877f1c-9c9d-8013-b668-f14bd1ac0ec0.png)

- Core components and tweaks
    - Initialization
    - Position encodings: RoPE, ALiBi, NoPE, QKnorm…
    - Activation functions: Relu, SwiGlu..
    - Tie word embeddings
    - Model layout (depth vs width for dense transformers, sparsity & #experts for MoEs)

- Training
    - Document masking
    - Remove weight decay from embeddings, Z-loss

- Going Sparse: MoE
- Excursion: Hybrid
- When to choose each: compute budget, deployment constraints, team expertise
> [TODO]: ideas for visuals: plot for dense and MoE side by side, an interactive plot showing how we go from MHA to MQA to GQA to MLA (e.g show heads merge), chart showing the distribution of architectures in SOTA models over time (2025 as the year of MoEs?)

#### Loubna’s ablations and results below (to be integrated in the main text)

####  **Embedding sharing** 

As explained in the ablations sections, we will start from Llama3.2 1B architecture for all our ablations. If you look at the [config](https://huggingface.co/datasets/HuggingFaceTB/ablations-training-configs/blob/main/baseline_config_1B.yaml), one thing that is different from a standard transformer is embedding sharing enabled by the flag  `tie_word_embeddings` . 

LLMs have two embedding components: input embeddings that serve as a token-to-vector lookup table (vocab_size × hidden_dim) and the output embeddings, which is the final linear layer mapping hidden states to vocabulary logits (hidden_dim × vocab_size). In the classic case where these are separate matrices, total embedding parameters are 2 × vocab_size × hidden_dim. Therefore, in small language models, embeddings can constitute a large portion of the total parameter count, especially with a large vocabulary size. This makes embedding sharing (reusing input embeddings in the output) a natural optimization for small models. 

![Image](/media/27877f1c9c9d804d9c82f7b3905578ff/image_27877f1c-9c9d-80aa-b968-c54c9fe7e5d7.png)

[TODO]: embed [https://huggingface.co/spaces/HuggingFaceTB/embeddings-sharing-visual](https://huggingface.co/spaces/HuggingFaceTB/embeddings-sharing-visual)

Larger models don't typically use this technique since embeddings represent a smaller fraction of their parameter budget. For example, total embeddings without sharing account for only 13% in Llama3.2 8B and 3% in Llama3.1 70B as show in the pie chart below.

![Image](/media/27877f1c9c9d804d9c82f7b3905578ff/image_27877f1c-9c9d-801d-841a-e35011491566.png)

[TODO]: embed the pie chart [https://huggingface.co/spaces/HuggingFaceTB/params-pie-chart](https://huggingface.co/spaces/HuggingFaceTB/params-pie-chart)

Next, we will assess the impact of embedding sharing on our ablation model. We draw insights from [MobileLLM's](https://arxiv.org/abs/2402.14905) comprehensive ablations on this technique at 125M scale, where they demonstrated that sharing reduced parameters by 11.8% with minimal accuracy degradation.

Since untied embeddings increase our parameter count from 1.2B to 1.48B, we need to decide how to make a fair comparison. We will compare two 1.2B models: our baseline with tied embeddings (16 layers) versus an untied version with fewer layers (12 layers) to maintain the same parameter budget. We also train a 1.46B model with untied embeddings and the same layer count as our baseline (16) as an additional reference point.

[TODO]: add the results

####  **Attention** 

Here we compare different attention mechanisms. Our baseline model uses 32 heads and 8 kv heads which corresponds to GQA with ratio 32/8=4. How would performance change if we used MHA, or if we went for even less kv heads and a higher GQA ratio?

Again changing the number of kv heads affects parameter count especially for the MHA case. For consistency, we adjust the number of layers for the MHA run since it has a 100M+ parameter discrepancy; for the rest we keep the default 16 layers.

| Attention Type | Query Heads | KV Heads | Layers | Parameter Count | Notes |
| --- | --- | --- | --- | --- | --- |
| MQA | 32 | 1 | 16 | 1.21B |
| GQA (ratio 16) | 32 | 2 | 16 | 1.21B |
| **GQA (ratio 8)** | **32** | **4** | **16** | **1.22B** | **Our baseline** |
| GQA (ratio 4) | 32 | 8 | 16 | 1.24B |
| GQA (ratio 2) | 32 | 16 | 15 | 1.22B | Reduced layers |
| MHA | 32 | 32 | 14 | 1.20B | Reduced layers |
| GQA (ratio 2) | 32 | 16 | 16 | 1.27B | Too large - not ablated |
| MHA | 32 | 32 | 16 | 1.34B | Too large - not ablated |
So we compare MHA, MQA and 4 setups for GQA (ratios 2, 4, 8, 16)

####  **From Word Order to Long Context: The Evolution of Positional Encodings** 

When transformers process text, they face a fundamental challenge: they naturally have no sense of word order, since they consume entire sequences simultaneously through parallel attention operations. This enables efficient training but creates a problem. Without explicit position information, "Adam beats Muon" looks identical to "Muon beats Adam" from the model's perspective.

The solution is positional embeddings: mathematical encodings that give each token a unique "address" in the sequence. But as we push toward longer and longer contexts - from the 512 tokens of early BERT to today's million-token models - the choice of positional encoding becomes increasingly critical for both performance and computational efficiency.

 **The Evolution of Position Encoding** 

Early transformers used simple  **Absolute Position Embeddings (APE)** , essentially learned lookup tables that mapped each position (1, 2, 3...) to a vector that gets added to token embeddings. This worked fine for short sequences but had a major limitation: models could only handle sequences as long as they were trained on. They had no learned representation for larger positions.

The field evolved toward  **relative position encodings**  that capture the distance between tokens rather than their absolute positions. This makes intuitive sense - whether two words are 3 positions apart matters more than whether they're at positions (5,8) versus (105,108).

 **ALiBi**  (Attention with Linear Biases), in particular, modifies the attention scores based on token distance. The further apart two tokens are, the more their attention gets penalized through simple linear biases applied to attention weights.

```python
## ALiBi applies distance-based penalties directly to attention scores
import torch
import math

def alibi_bias(seq_len, slopes):
    """
    Build ALiBi bias matrices.

    slopes: list of slopes (one per attention head)
    Returns: [n_heads, seq_len, seq_len]
    """
    n_heads = len(slopes)
    bias = torch.zeros(n_heads, seq_len, seq_len)

    for h, slope in enumerate(slopes):
        for i in range(seq_len):      # query position
            for j in range(seq_len):  # key position
                distance = j - i
                # bias = distance-based penalty
                bias[h, i, j] = -slope * distance

    return bias

## Q, K: [batch, heads, seq, d_head]
Q = torch.randn(1, 2, 4, 8)
K = torch.randn(1, 2, 4, 8)

scores = (Q @ K.transpose(-2, -1)) / math.sqrt(Q.size(-1))  # raw attention scores
bias = alibi_bias(seq_len=5, slopes=[0.1, 0.01])

## 👉 ALiBi bias is added here, before softmax
scores = scores + bias.unsqueeze(0)  # add bias for each batch
attn_weights = torch.softmax(scores, dim=-1)
```
But the technique that has dominated recent large language models is [ **Rotary Position Embedding (RoPE)** ](https://arxiv.org/abs/2104.09864).

 **RoPE: Position as Rotation** 

Here is RoPE's core insight: encode position information as rotation angles in a high-dimensional space. Instead of adding position vectors to token embeddings, RoPE rotates the query and key vectors by angles that depend on their absolute positions.

The intuition is that we treat each pair of dimensions in our embeddings as coordinates on a circle and rotate them by an angle determined by:

- The token's position in the sequence
- Which dimension pair we're working with (different pairs rotate at different frequencies)
```python
import torch

def apply_rope_simplified(x, pos, dim=64, base=10000):
    """
    Rotary Position Embedding (RoPE)

    Idea:
    - Each token has a position index p (0, 1, 2, ...).
    - Each pair of vector dimensions has an index k (0 .. dim/2 - 1).
    - RoPE rotates every pair [x[2k], x[2k+1]] by an angle θ_{p,k}.
    
    Formula:
      θ_{p,k} = p * base^(-k / (dim/2))

    - Small k (early dimension pairs) → slow oscillations → capture long-range info.
    - Large k (later dimension pairs) → fast oscillations → capture fine detail.
    """
    rotated = []
    for i in range(0, dim, 2):
        k = i // 2  # index of this dimension pair

        # Frequency term: higher k → faster oscillation
        inv_freq = 1.0 / (base ** (k / (dim // 2)))
        theta = pos * inv_freq  # rotation angle for position p and pair k

        cos_t = torch.cos(torch.tensor(theta, dtype=x.dtype, device=x.device))
        sin_t = torch.sin(torch.tensor(theta, dtype=x.dtype, device=x.device))

        x1, x2 = x[i], x[i+1]

        # Apply 2D rotation
        rotated.extend([x1 * cos_t - x2 * sin_t,
                        x1 * sin_t + x2 * cos_t])

    return torch.stack(rotated)
    
    
## Q, K: [batch, heads, seq, d_head]
Q = torch.randn(1, 2, 4, 8)
K = torch.randn(1, 2, 4, 8)

## 👉 apply RoPE to Q and K *before* the dot product
Q_rope = torch.stack([apply_rope(Q[0,0,p], p) for p in range(Q.size(2))])
K_rope = torch.stack([apply_rope(K[0,0,p], p) for p in range(K.size(2))])

scores = (Q_rope @ K_rope.T) / math.sqrt(Q.size(-1))
attn_weights = torch.softmax(scores, dim=-1)

```
The magic happens when two tokens interact through attention. The dot product between their rotated representations directly encodes their relative distance through the phase difference between their rotation angles. Tokens that are 5 positions apart will always have the same angular relationship, regardless of their absolute positions in the sequence.

 **Why RoPE Dominates** 

RoPE has become the de facto standard for several compelling reasons:

1.  **Extrapolation capability** : Unlike absolute embeddings, RoPE can handle sequences longer than training length by continuing the rotation patterns. By increasing theta value we can extrapolate to larger sequence lengths.
1.  **Relative distance encoding** : The attention mechanism naturally captures how far apart tokens are
1.  **Efficiency** : Position information is encoded through rotations, not learned embeddings, which required just trigonometric operations during forward pass
Most major models today use RoPE: Llama, Qwen, Gemma, and many others. The technique has proven robust across different model sizes and domains.

> [TODO]: Visualization showing how RoPE rotates embedding dimensions at different frequencies, with tokens at different positions creating unique fingerprints that encode relative distances

 **The Long Context Challenge** 

As models push toward very large contexts, even RoPE faces challenges. The standard approach of increasing RoPE's frequency parameter (θ) during fine-tuning helps but has limits. This is where newer techniques can help.

 **NoPE (No Position Embedding)** : what if we simply removed positional embeddings entirely? Research has shown that transformer variants trained without any positional encoding can still perform well on many tasks, relying purely on content similarity for attention patterns.

The NoPE approach has intriguing properties:

- No length limitations since there's no position encoding to extrapolate
- Models naturally develop attention patterns based on content similarity
- Can be particularly effective for information retrieval tasks
However, NoPE models typically show weaker performance on tasks requiring strong positional reasoning and may struggle with certain types of structured text.

 **RNoPE Hybrid Approach:** [recent research](https://arxiv.org/abs/2501.18795) from Cohere suggests that combining different positional encoding strategies might be optimal. They introduce,  **RNoPE** (called NoPE in the rest of this blog post for simplicity **)**  alternates between RoPE and NoPE layers throughout the model. This technique was recently used in Llama4, Command A and SmolLM3.

-  **RoPE layers**  provide explicit positional information and handle local context with recency bias
-  **NoPE layers**  improve information retrieval across long distances
> [TODO]: check llama4 approach for an aside

This hybrid approach allows each layer type to specialize: NoPE layers develop strong retrieval capabilities for finding relevant information regardless of distance, while RoPE layers maintain the positional reasoning needed for tasks like following instructions or understanding document structure.

> [TODO]: add plots for attention sinks, or make them in the ablation

Now let's test whether this hybrid approach works. We'll compare pure RoPE 1B ablation baseline against a NoPE variant that removes positional encoding every 4th layer. The key question: can we maintain strong short-context performance while gaining long-context capabilities? 

#### The tokenizer

While it might not steal the spotlight like architecture innovations, the tokenizer is one of the most underrated components of any language model. Think of it as the translator between human language and the mathematical world our model lives in, and just like any translator, the quality of the translation matters. So how do we build or choose the right tokenizer for our needs?

 **Tokenizer fundamentals** 

At its core, a tokenizer converts raw text into a sequence of integers that our model can process. Before diving into the technical details, we should first answer some fundamental questions that will guide our tokenizer design:

-  **What languages do we want to support?**  If we're building a multilingual model but our tokenizer has only seen English, the model will be inefficient when encountering non-English text, which will get split into many more tokens than necessary. This directly impacts performance, training cost and inference speed.
-  **Which domains matter to us?**  Beyond languages, domains like math and code have very different character distributions and patterns. Representation of digits and tokenization of code will need special consideration.
-  **Do we know our target data mixture?**  If we plan to train our tokenizer from scratch, ideally, we should train it on a sample that mirrors our final training mixture. 
Once we have answered these questions, we can examine the key design decisions:

 **Vocabulary size** 

The vocabulary is essentially a dictionary listing all tokens (words, subwords, or symbols) our model recognizes. Larger vocabularies compress text more efficiently since we generate fewer tokens per sentence, but there's a computational trade-off. The vocabulary size directly determines the width of our input and output embeddings, so a 128k vocabulary means those matrices have 128,000 columns each. For smaller models, this becomes a significant chunk of total parameters, but the relative cost shrinks as models scale up. That's why modern state-of-the-art models like Llama 3 have adopted vocabularies in the 128k+ range to improve token efficiency across diverse languages.  

The sweet spot depends on our target coverage. For English-only models, around 50k tokens usually suffices, but multilingual models often need 100k+ to efficiently handle diverse writing systems and languages.

> [TODO]: add some plot for tokenizer efficiency given vocab size, like leandro’s for bigcode

> [TODO]: add a visualization of words getting tokenized by different tokenizers

> [ASIDE]: Set vocabulary size to a multiple of 128 (e.g., 50,304 instead of 50,000) to optimize throughput. Modern GPUs perform matrix operations better when dimensions are divisible by higher powers of 2, as this ensures efficient memory alignment and reduces overhead from misaligned memory accesses. More details in this [blog](https://www.thonking.ai/p/what-shapes-do-matrix-multiplications).

 **Tokenization algorithm** 

 **BPE (Byte-Pair Encoding)**  remains the most popular choice, and for good reason. The process typically starts with pre-tokenization; splitting text into words or meaningful chunks (like separating punctuation from words). Then we build a base vocabulary from the characters or bytes within those chunks. From there, BPE iteratively finds the most frequent pair of adjacent tokens in our training data and merges them into a single new token, repeating this thousands of times until we reach our target vocabulary size. This bottom-up approach means that common words like "the" naturally become single tokens while rare words get broken into recognizable subword pieces. One thing to watch out for is the pre-tokenization regex pattern: we might need to adjust it for non-English languages or code to avoid awkward splits.

> [ASIDE]: For a deep dive into tokenization fundamentals and BPE implementation, Andrej Karpathy's ["Let's build the GPT Tokenizer"](https://www.youtube.com/watch?v=zduSFxRajkE) is an excellent hands-on tutorial 

Other algorithms like WordPiece (used in BERT) or SentencePiece exist but haven't gained the same widespread adoption. There's also growing research interest in tokenizer-free approaches that work directly on bytes or characters, potentially eliminating tokenization altogether.

> [TODO]:  elaborate on tokenizer free approaches

Once we've settled on vocabulary size and algorithm, the big question is: should we use an existing tokenizer that has our target vocab size or train from scratch? The answer lies in coverage, we want a tokenizer that handles our target languages and domains well. But here's the thing: how do we actually know if a tokenizer is doing a good job? We could eyeball the tokenization, but that's not enough, the same way we can't just make architecture changes based on our intuition without ablations. Luckily, we have metrics to measure tokenizer quality.

 **Measuring Tokenizer Quality** 

To evaluate how well a tokenizer performs, we can use two key metrics:

-  **Fertility**  measures the average number of tokens needed to encode a word. Lower fertility means better compression, which translates to faster training and inference. Think of it this way: if one tokenizer needs one or two more tokens to encode most words while another does it in less tokens, the second one is clearly more efficient.
-  **Proportion of continued words**  tells us what percentage of words get split into multiple pieces. Lower percentages are better since it means fewer words get fragmented, leading to more efficient tokenization.
[https://arxiv.org/abs/2402.01035](https://arxiv.org/abs/2402.01035)

[https://occiglot.eu/posts/eu_tokenizer_perfomance/](https://occiglot.eu/posts/eu_tokenizer_perfomance/)

[https://arxiv.org/pdf/2411.12240v2](https://arxiv.org/pdf/2411.12240v2)

[https://huggingface.co/spaces/huggingface/number-tokenization-blog](https://huggingface.co/spaces/huggingface/number-tokenization-blog)

For specialized domains like code and math, though, besides fertility we need to dig deeper and look at how well the tokenizer handles domain-specific patterns. Most modern tokenizers do single-digit splitting (so "123" becomes ["1", "2", "3"]), and research has found this helps with mathematical reasoning. It might seem counterintuitive to break numbers apart, but it actually helps models learn arithmetic patterns more effectively. Some tokenizers like Llama3 encode numbers from 1 to 999 as unique tokens and the rest are composed of these tokens.

> [TODO]: add citations

So we can measure fertility on our target domains to assess the weaknesses and strengths of a tokenizer. The table below compares fertility across popular tokenizers for different languages and domains.

> [TODO]: add code snippet for computing fertility and Pcw

> [TODO]: add table comparing different tokenizers

 **Choosing Between Existing and Custom Tokenizers** 

Currently, there's a good selection of strong tokenizers available. Many recent models start with something like GPT4's tokenizer and augment it with additional multilingual tokens. As we can see in table X, Llama 3's tokenizer performs well on average across multilingual text and code, while Qwen 2.5 excels particularly on Chinese and some low-resource languages.

-  **When to use existing tokenizers:**  If our target use case matches the language or domain coverage of the best tokenizers above (Llama, Qwen, Gemma), then they are solid choices that were battle-tested.
-  **When to train our own:**  If we’re training for low-resource languages or have a very different data mixture, we’ll likely need to train our own tokenizer to ensure good coverage.  In which case it's important that we train the tokenizer on a dataset close to what we believe the final training mixture will look like. This creates a bit of a chicken-and-egg problem since we need a tokenizer to run data ablations and find the mixture. But we can retrain the tokenizer before launching the final run and verify that downstream performance improves and fertilities are still good.
Your tokenizer choice might seem like a technical detail, but it ripples through every aspect of your model's performance. So don't be afraid to invest time in getting it right.

#### SmolLM3

Now that we've explored the architectural landscape and run our systematic ablations, let's see how this all comes together in practice for a model like SmolLM3.

The SmolLM family is about pushing the boundaries of what's possible with small models. SmolLM2 delivered three capable models at 135M, 360M, and 1.7B parameters, all designed to run efficiently on-device. For SmolLM3, we wanted to scale up performance while staying small enough for phones, and tackle SmolLM2's weak spots: multilinguality, very long context handling, and strong reasoning capabilities. We chose 3B parameters as the sweet spot for this balance.

Since we were scaling up a proven recipe, we naturally gravitated toward dense transformers. MoE wasn't implemented in nanotron yet, and we already had the expertise and infrastructure for training strong small dense models. More importantly, for edge device deployment we're memory-bound, an MoE with many parameters even if only a few are active would be limiting since we still need to load all experts into memory, making dense models more practical for our edge deployment targets.

 **Ablations:** We started with SmolLM2 1.7B's architecture as our foundation, then trained a 3B ablation model on 100B tokens using Qwen2.5-3B layout. This gave us a solid baseline to test each modification individually. Each architecture change needed to either improve the loss and downstream performance on English benchmarks or provide measurable benefits like inference speed without quality degradation.

Here's what we tested before launching the run that made the cut:

> [TODO]: add trackio widgets and configs for each ablation

 **Tokenizer:**  Before diving into architecture modifications, we needed to choose a tokenizer. We found a good set of tokenizers that covered our target languages and domains. Based on our fertility analysis, Llama3.2's tokenizer gave us the best tradeoff between our 6 target languages while keeping the vocabulary at 128k, large enough for multilingual efficiency but not so large that it bloated our 3B parameter count with embedding weights.

 **Grouped Query Attention (GQA)** : We reconfirmed our earlier finding that GQA with 4 groups matches Multi-Head Attention performance, but this time at 3B scale with 100B tokens. The KV cache efficiency gains were too good to pass up, especially for on-device deployment where memory is precious.

 **NoPE for long context** : We implemented Nope, by removing RoPE every 4th layer. Our 3B ablation confirmed the findings in the section above. NoPE improved long context handling without sacrificing short context performance.

 **Intra-document attention masking** : We prevent cross-document attention during training to help with training speed and stability when training on very large sequences, again we find that this doesn’t impact downstream performance and gives a smoother and lower loss.

 **Model layout optimization** : We compared layouts from recent 3B models in the literature, some prioritizing depth, others width. We tested Qwen2.5-3B (3.1B), Llama3.2-3B (3.2B), and Falcon3-H1-3B (3.1B) layouts on our training setup. The results were interesting: all layouts achieved nearly identical loss and downstream performance, despite Qwen2.5-3B actually having fewer parameters. But there was a tiebreaker, Qwen2.5-3B's deeper architecture aligned with research showing that network depth benefits reasoning tasks, one of our key improvement targets. Therefore, we went with the deeper layout, betting it would help as training progressed.

> [TODO]: insert table comparing layouts

 **Stability improvements** : We kept tied embeddings from SmolLM2 but added a new trick inspired by OLMo2, removing weight decay from embeddings. Our ablations showed this didn't hurt performance while lowering embedding norms, which can help for preventing training divergence.

The beauty of this systematic ablations approach is that we could confidently combine all these modifications, knowing each had been individually validated. We tested each change separately, then combined them all to make sure they worked well together.

Of course, having a solid architecture is just the beginning. As we'd soon see, the real challenges were waiting for us in the data mixture, hyperparameter tuning, and the inevitable surprises that come with training at scale. 

#### Rules of engagement

TL;DR: Your use case drives your choices.

 **Let your deployment target guide architectural decisions.**  Consider how and where your model will actually run when evaluating new architectural innovations.

 **Strike the right balance between innovation and pragmatism.**  We can't afford to ignore major architectural advances - using Multi-Head Attention today when GQA and better alternatives exist would be a poor technical choice. Stay informed about the latest research and adopt techniques that offer clear, validated benefits at scale. But resist the temptation to chase every new paper that promises marginal gains (unless you have the resources to do so or your goal is architecture research).

 **Systematic beats intuitive.**  Validate every architecture change, no matter how promising it looks on paper. Then test modifications individually before combining them to understand their impact.

 **Scale effects are real - re-ablate at target size when possible.**  Don't assume your small-scale ablations will hold perfectly at your target model size. If you have the compute, try to reconfirm them.

 **Validate tokenizer efficiency on your actual domains.**  Fertility metrics across your target languages and domains matter more than following what the latest model used. A 50k English tokenizer won't cut it for serious multilingual work, but you don't need a 256k vocab if you're not covering that many languages either.

Now that the model architecture is now decided, it’s time to tackle the optimizer and hyperparameters that will drive the learning process.

### Optimizer and training hyperparameters

The pieces are coming into place. We've run our ablations, settled on the architecture, and chosen a tokenizer. But before we can actually launch the training, there are still some crucial missing pieces: which optimizer should we use? What learning rate and batch size? How should we schedule the learning rate over training?

The tempting approach here is to just borrow values from another strong model in the literature. After all, if it worked for big labs, it should work for us, right? And for many cases that will work just fine if we're taking values from a similar architecture and model size.

However, we risk leaving performance on the table by not tuning these values for our specific setup. Literature hyperparameters were optimized for specific data and constraints, and sometimes those constraints aren't even about performance. Maybe that particular batch size was chosen because of hardware limitations different from ours, or that learning rate was picked early in development and never revisited. Even when model authors do thorough hyperparameter sweeps, those optimal values were found for their exact combination of architecture, data, and training regime, not ours.

In this chapter, we'll explore the latest optimizers (and see if trusty old AdamW still stands the test of time), dive into learning rate schedules that go beyond the standard cosine decay and figure out how to tune the learning rate and batch size given a model and data size.

#### Optimizers: AdamW and beyond (Elie)

- AdamW configuration: beta values, weight decay, gradient clipping
- New optimizers: Muon (& MuonClip), Soap, AdeMaMix..
- Comparison and overview of recent models and their optimizers
#### Learning Rate

The learning rate might be a single number in our config file, but it's one of the most important hyperparameters we’ll set. Think of it as the size of steps our model takes when climbing the loss landscape: too small and we’ll never reach the summit before our compute budget runs out, too large and we’ll overshoot the peak entirely.

 **What Learning Rate Actually Does** 

At each training step, the learning rate controls how much we adjust our model weights based on the computed gradients. It's a multiplier that determines the magnitude of each update.

 **Too low learning rates**  lead to painfully slow training that can get trapped in poor local minima. Our loss curves will look flat, and we’ll burn through our compute budget without meaningful progress.

 **Too high learning rates**  cause the optimizer to take massive steps that overshoot optimal solutions. In the worst case, this leads to training divergence where the loss explodes.

The goal is finding that sweet spot: a high enough learning rate we can use without causing instability, while accounting for the fact that what's stable at the beginning might become unstable as training progresses.

> todo: overview of recent LLMs hyperparameters selection approach

But before we explore how to choose a good learning rate, we shouldn’t forget that it usually doesn't stay constant throughout training. How it changes over time is just as important as the peak value itself, which brings us to learning rate schedules.

 **Learning Rate Schedules: Beyond Cosine Decay** 

For years, cosine decay was the go-to schedule for training LLMs: start at a peak learning rate after warmup, then smoothly decrease following a cosine curve. It's simple, predictable, and works reasonably well. But its main disadvantage is inflexibility; we need to know our total training steps upfront.
What if the model hasn't plateaued and we decide to train longer? What if we get access to more compute? What if we're running scaling laws and want to train the same model on different token counts? Cosine decay forces us to restart from scratch.

 **Warmup-Stable-Decay (WSD) and Multi-Step Variants:**  Many teams now use a scheduler where you don't need to start decaying immediately after warmup. Instead, you maintain a constant high learning rate for most of training, then apply sharp decay steps near the end. It also matches cosine decay performance when decaying for the last 10% to 20% of training steps while offering the flexibility cosine lacks thanks to the stable phase that can be adjusted during training.

> [TODO]: add learning rate plots for each schedule (cosine, wsd, multi-step)

> [TODO]: say something about number of warmup steps

> [TODO]: say something about different decay options: linear, sqrt, cosine.. + impact of decay period + option of doing cosine and then linear decay 

Below is DeepSeek's Multi-Step schedule:

Consider DeepSeek's Multi-Step schedule shown in the plot below: they use 2k warmup steps to reach maximum learning rate, maintain that constant rate until 80% of tokens are processed, then drop to 31.6% of max rate, and finally drop to 10% of max rate after 90% of tokens (using ×0.316 multipliers for both drops).

This approach offers significant practical advantages. We can extend training without recalculating the entire schedule, making it ideal for scaling law experiments where we want to train the same model on different token counts. The stable phase also makes it easy to resume or extend runs mid-training, and the performance matches cosine decay while being more practical for real-world training scenarios.

Now that we have a good overview of popular learning rate schedules, the next question is: what should that peak learning rate actually be?

 **Finding The Optimal Learning Rate** 

Theory is nice, but how do we actually pick the right learning rate for our specific setup? The answer is systematic experimentation.

 **Sweeps** 

For SmolLM3, we trained 3B models on 100B tokens with AdamW using the WSD scheduler, comparing several learning rates. We found that 2e-4 converged much faster than 1e-4 in both loss and downstream performance, while 3e-4 was only slightly better than 2e-4. The marginal gains from 3e-4 came with increased risk of instability during long training runs, so we chose 2e-4 as our sweet spot.
But running sweeps for every model size gets expensive quickly, and more importantly, it doesn’t account for the planned number of training tokens. This is where scaling laws become invaluable.

> [TODO]: show some trackio learning rate sweeps

> [TODO]: show plot of grad norm increase/instability risk with higher learning rates

 **Scaling laws** 

The optimal learning rate isn’t just about model architecture and size, it depends on our compute budget, which combines both the number of model parameters and the number of training tokens. In practice, both of these factors interact to determine how aggressive or conservative our updates should be. This is where scaling laws come in.

Scaling laws are empirical relationships that describe how model performance evolves as we increase training scale, whether that’s through larger models or more training data. Historically, they’ve been used to study how to best allocate compute between model size and dataset size — a topic we’ll revisit in the data section later. But scaling laws can also help us predict how to adjust key hyperparameters like the learning rate and batch size as we scale up training, as it was done in recent work by DeepSeek and Qwen2.5. This gives us principled defaults rather than relying entirely on hyperparameter sweeps.

To apply scaling laws in this context, we need a way to quantify training scale. The standard metric is the compute budget, denoted C and measured in FLOPs, which can be approximated as:

 $C=6×N×D$  

 **N**  is the number of model parameters (e.g., 1B = 1e9),  **D**  is the number of training tokens. This is often measured in  **FLOPs**  (floating-point operations), a hardware-agnostic way of quantifying how much actual computation is being done. But if FLOPs feel too abstract, just think of it this way: training a 1B parameter model on 100B tokens consumes about 2× fewer FLOPs than training a 2B model on 100B tokens, or a 1B model on 200B tokens.

The constant 6 comes from empirical estimates of how many floating-point operations are required to train a Transformer, roughly 6 FLOPs per parameter per token.

> [TODO]: mention that deepseek used another formula to represent model scale and do C = MD

Now, how does this relate to learning rate? We can derive scaling laws that predict optimal learning rates and batch sizes as functions of total compute budget (C). They help answer questions like:

- How should the learning rate change as I scale from 1B to 7B parameters?
- If I double my training data, should I adjust the learning rate?
Naturally the optimal learning rate typically decreases as model size increases but the exact relationship depends on our data distribution and size.

Here's how it works in practice if we follow the DeepSeek approach: First, we choose our learning rate scheduler, ideally WSD for its flexibility. Then, we train models across a range of compute budgets (e.g., 1e17, 5e17, 1e18, 5e18, 1e19, 2e19 FLOPs) with different combinations of batch sizes and learning rates. In simpler terms: we train different model sizes for different numbers of tokens, testing different hyperparameter settings. This is where the WSD scheduler shines, we can extend the same training run to different token counts without restarting. For each setup, we perform sweeps over learning rate and batch size and identify the configurations that result in near-optimal performance, typically defined as being within a small margin (e.g., 0.25%) of the best validation loss (computed on an independent validation set, with a similar distribution to the training set). This gives us a good enough zone to work from.

> [TODO]: show WSD learning rate plot where we decay at different points to perform scaling laws

An important finding from this process is that for a fixed model size and compute budget, performance remains stable across a wide range of hyperparameters. This means there’s a broad sweet spot rather than a narrow optimum. We don’t need to find the perfect value, just a value that’s close enough, which makes the whole process much more practical.

Each near-optimal configuration gives us a data point — a tuple of (compute budget C, optimal learning rate η) or (C, optimal batch size B). When plotted on a log-log scale, these relationships typically follow power-law behavior, appearing as approximately straight lines (as shown in the figure above). By fitting these data points, we can extract scaling laws that describe how optimal hyperparameters evolve with compute like the ones derived by DeepSeek:

 $\eta_{\text{opt}} = 0.3118 \cdot C^{-0.1250}$  

 $B_{\text{opt}} = 0.2920 \cdot C^{0.3271}$  

The core intuition behind these results is that as training becomes larger and longer, we want  **more stable updates**  (hence, smaller learning rates) and  **more efficient gradient estimation**  (hence, larger batch sizes).

![Image](/media/27877f1c9c9d804d9c82f7b3905578ff/image_27877f1c-9c9d-80a9-b4d0-f2129716632d.png)

 **How stable are scaling laws within a data distribution, and what happens when we change it?** An important observation from DeepSeek is that these scaling laws are quite stable within a given data distribution. So once you’ve fitted them for a specific dataset or mixture (e.g. FineWeb + The Stack), you can reuse them across different model sizes or token counts. However, they are sensitive to distributional shifts and data quality. If you switch from English-only to multilingual data, or even from FineWeb to FineWeb-Edu, the optimal learning rate and batch size may shift noticeably. Potentially making the values above (from DeepSeek) not transferable to other training setups like ours. So we can invest in finding the scaling laws once for our specific data mixture and reuse it across different model sizes.

> [TODO]: add some small scaling law experiments

 **μP (Maximal Update Parameterization)** 

μP provides a principled approach to transfer hyperparameters across model sizes. The core idea is to parameterize your model in a way where optimal hyperparameters remain stable as you scale model width. We'll go over this method in more detail in the next section about batch size!

#### Batch size and training dynamics (Elie)

> loubna: maybe we should merge batch size and learning rate, we mention the batch size is in the scaling laws section above, and mup below also tunes the learning rate

- Batch size: training vs token efficiency, critical batch size
- Batch size schedule
- MuP
- overview of recent LLMs hyperparameters selection approach
#### Other hyperparameters

- weight decay, gradient clipping (or do it in optimizer section?)
- lr warmup
#### SmolLM3

> [TODO]: look at optimizer ablations results again and refine text if needed

At the time of ablations before launching SmolLM3, we compared three optimizers: AdamW, AdEMAMix, and Muon. We first ran smaller scale ablations on a 1B model trained on 100B tokens, and found results consistent with the ablations from the section above:

- Muon was sensitive to the learning rate - some settings caused divergence, but when properly tuned could outperform AdamW's best learning rate
- AdeMaMix was less sensitive than Muon and achieved a similar loss when tuning the learning rate
- AdamW was more stable than both alternatives, but achieves a higher final loss when compared to tuned Muon and AdeMaMix. 
However, when we repeated the experiments at 3B scale, we ran into more frequent divergence with Muon and AdeMaMix - something we'll understand better later in the blog. And given their sensitivity to the learning rate even at 1B scale, we decided to go with AdamW (beta1: 0.9, beta2: 0.95) as our optimizer of choice. We used weight decay 0.1 and gradient clipping 1.

For the learning rate schedule, we chose WSD. We had used it successfully in SmolLM2, and it proved to be one of our best decisions for ease of use and flexibility regarding total training duration plus the ability to run mid-training decay experiments. We ran learning rate sweeps and settled on 2e-4. For the global batch size, we tested values from 2M to 4M tokens but found minimal impact on the loss or downstream performance, so we chose 2.36M tokens - the size that gave us the best throughput.

#### Rules of engagement

TL;DR: Balance exploration and execution, done is better than perfect.

We’ve talked a lot about the "what" — optimizer, learning rate, batch size — but just as important is the  **how** . How do we decide what’s worth experimenting with? How do we structure our time? When do we stop exploring and just train? 

 **Allocate your time wisely between exploration and execution.**  Spending weeks perfecting a minor improvement from a new method is less valuable than investing that same compute in better data curation or more thorough architecture ablations. From our experience, and though it might disappoint architecture enthusiasts, the biggest performance gains usually come from data curation.

 **When in doubt, choose flexibility and stability over peak performance.**  If two methods perform equally well, pick the one that offers more flexibility or that has better implementation maturity and stability. A learning rate schedule like WSD that lets us extend training or run mid-training experiments is more valuable than a rigid schedule that might converge slightly better.

 **Know when to stop optimizing and start training.**  There's always one more hyperparameter to tune or one more optimizer to try. Set a deadline for exploration and stick to it - the model we actually finish training will always beat the perfect model we never start.

Perfect is the enemy of good, especially when we're working with finite compute budgets and deadlines.

> loubna: some of these rules are generic and can also go under the architecture section

### Scaling laws: How many parameters, how much data?

In the early days of deep learning, before language models (and the clusters they were trained on) were “large”, training runs were often not heavily constrained by compute. When training a model, you’d just pick the largest model and batch size that fit on your hardware and then train until the model started overfitting or you ran out of data. However, even in these early days there was a sense that scale was helpful — for example, [Hestness et al.](https://arxiv.org/abs/1712.00409) provided a comprehensive set of results in 2017 showing that training larger models for longer produced predictable gains. 

In the era of large language models, we are  *always*  compute-constrained. Why? These early notions of scalability were formalized by [Kaplan et al.’s work on Scaling Laws for Neural Language Models](https://arxiv.org/abs/2001.08361), where it was shown that language model performance is remarkably predictable across many orders of magnitude of scale. This set off an explosion in the size and training duration of language models, because it provided a way to  *accurately predict* how much performance would improve from increasing scale. Consequently, the race to build better language models became a race to train larger models on larger amounts of data with ever-growing compute budgets, and the development of language models quickly became compute-constrained.

When faced with compute constraints, the most important question is whether to train a larger model or to train on more data. Surprisingly, Kaplan et al.’s scaling laws suggested that it was advantageous to allocate much more compute towards model scale than previous best practices — motivating, for example, training the gargantuan (175B parameters) GPT-3 model on a relatively modest token budget (300B tokens). On reexamination, [Hoffman et al.](https://arxiv.org/abs/2203.15556) found a methodological issue with Kaplan et al.’s approach, ultimately re-deriving scaling laws that suggested allocating much more compute to training duration which indicated, for example, that compute-optimal training of the 175B-parameter GPT-3 should have consumed 3.7T tokens!

Scaling laws have another shortcoming: They aim to predict the model size and  *training*  duration that achieves the best performance given a certain compute budget, but they fail to account for the fact that larger models are more expensive  *after*  training. Put another way, we might actually prefer to use a given compute budget train a smaller model for longer — even if this isn’t “compute-optimal” — because this will make inference costs cheaper. This could be the case if we expect that a model will be see a lot of inference usage (for example, because it’s being released openly 🤗). Recently, this practice of “overtraining” models beyond the training duration suggested by scaling laws has become standard practice, and is the approach we took when developing SmolLM3.

While scaling laws provide a suggestion for the model size and training duration given a particular compute budget, choosing to overtrain means you have to decide these factors yourself. For SmolLM3, we started by picking a target model size of 3 billion parameters. Based on recent models of a similar scale like Qwen3 4B, Gemma 3 4B, and Llama 3.2 3B, we considered 3B to be large enough to have meaningful capabilities (such as reasoning and tool calling), but small enough to enable super fast inference and efficient local usage. To pick a training duration, we first noted that recent models have been  *extremely*  overtrained — for example, the aforementioned Qwen3 series is claimed to have been trained for 36T tokens! As a result, training duration is often dictated by the amount of compute available. We secured 384 H100s for N weeks, which provided a budget for training on 11 trillion tokens (assuming an MFU of N%).

Now that we’re settled on our model architecture, training setup, model size, and training duration, we need to prepare two critical components: the data mixture that will teach our model, and the infrastructure that will train it reliably. With SmolLM3's architecture set at 3B parameters, we needed to curate a data mixture that would deliver strong multilingual, math and code performance, and set up infrastructure robust enough for 11 trillion tokens of training. Getting these fundamentals right is essential, even the best architectural choices won't save us from poor data curation or unstable training systems. 

## The art of data curation

Picture this: you've spent weeks perfecting your architecture, tuning hyperparameters, and setting up the most robust training infrastructure money can buy. Your model converges beautifully, and then... it can't write coherent code, struggles with basic math, and maybe even switches languages mid-sentence. What went wrong?
The answer usually lies in the data. While we obsess over fancy architectural innovations and hyperparameter sweeps, data curation often determines whether our model becomes genuinely useful or just another expensive experiment. It's the difference between training on random web crawls versus carefully curated, high-quality datasets that actually teach the skills we want our model to learn.

If model architecture defines  *how*  your model learns, then data defines  *what*  it learns, and no amount of compute or optimizer tuning can compensate for training on the wrong content. Moreover, getting the training data right isn’t just about having good datasets. It’s about assembling the right  **mixture** : balancing conflicting objectives (like strong English vs. robust multilinguality) and tuning data proportions to align with our performance goals. This process is less about finding a universal best mix and more about asking the right questions and devising concrete plans to answer them:

- What do we want our model to be good at?
- Which datasets are best for each domain and how do we mix them?
- Do we have enough high-quality data for our target training scale?
This section is about navigating these questions using a mix of principled methods, ablation experiments, and a little bit of alchemy, to turn a pile of great datasets into a great training mixture.

#### What’s a good data mixture and why it matters most

We expect a lot from our language models — they should be able to help us write code, give us advice, answer questions about pretty much anything, complete tasks using tools, and more. Plentiful pre-training data sources like the web don’t cover the full range of knowledge and capabilities needed for these tasks. As a result, recent models additionally rely on more specialized pre-training datasets that target specific domains like math and coding. We have done a lot of past work on curating datasets, but for SmolLM3 we primarily made use of preexisting datasets. To learn more about dataset curation, check out our reports on building [FineWeb and FineWeb-Edu](https://huggingface.co/spaces/HuggingFaceFW/blogpost-fineweb-v1), [FineWeb2](https://arxiv.org/abs/2506.20920), [Stack-Edu, and FineMath](https://arxiv.org/abs/2502.02737).

When focusing on some particular capability like coding, it can be tempting to upweight task-relevant data like source code. However, upweighting one source implicitly downweights all of the other sources, which can harm the language model’s capabilities in other settings. Training on a collection of different sources therefore involves striking some kind of balance between downstream capabilities.

Additionally, across all of these sources and domains, there’s often a subset of “high-quality” data that is especially helpful at improving the language model’s capabilities. Why not just throw out all the lower quality data and train on the highest quality data only? For SmolLM3’s large training budget of 11T tokens, doing such extreme filtering would result in repeating data many times. Prior work has shown that this kind of repetition can be harmful, so we should ideally be able to make use of higher and lower quality while still maximizing model performance.

To balance data across sources and make use of high-quality data, we carefully designed both the  *mixture*  (i.e. relative proportion training documents from each source) and the  *curriculum*  (i.e. the way that the mixture changes over the course of training). Since a language model’s performance on some particular task or domain depends heavily on the amount of data it saw that is relevant to that task, tuning the mixing weights provides a direct way of balancing the model’s capabilities. On the other hand, using a curriculum provides a way to make use of lower quality data because a language model’s final behavior and performance depends most heavily on data seen towards the end of training. This allows us to satisfy our large token budget by upweighting more plentiful sources early in training and mixing in smaller, higher quality sources towards the end.

#### Ablation setup: how to systematically test data recipes

When testing data mixtures, our approach is similar to how we run architecture ablations, with one difference: we try to run them at the target model scale. Small and large models have different capacities, for example a very small model might struggle to handle many languages, while a larger one can absorb them without sacrificing performance elsewhere. Therefore running data ablations at too small a scale risks drawing the wrong conclusions about the optimal mix.

For SmolLM3, we ran our main data ablations directly on the 3B model, using shorter training runs of 50B and 100B tokens. We also used another type of ablation setup: annealing experiments. Instead of training from scratch with different mixtures, we took an intermediate checkpoint from the main run and continued training with modified data compositions. This approach, which we'll explore in detail later, allows us to test data mixture changes for doing what we call multi-stage training (i.e changing the training mixture mid-training). For evaluation, we expanded our benchmark suite to include multilingual tasks alongside our standard English evaluations, ensuring we could properly assess the trade-offs between different language ratios.

#### SmolLM3: Curating the data mixture (web, multilingual, math, code)

> [TODO]: add ablations and results

For SmolLM3, we wanted a model that can handle English and multiple other languages, and excel in math and code. These domains — web text, multilingual content, code and math — are common in most LLMs, but the process we’ll describe here applies equally if you’re training for a low-resource language or a specific domain such as finance or healthcare. The method is the same: identify good candidate datasets, run ablations, and design a mixture that balances all the target domains.

We won’t cover how to build high-quality datasets here, since we’ve already detailed that extensively in earlier work (FineWeb, FineWeb2, FineMath and Stack-Edu). Instead, this section focuses on how we  *combine*  those datasets into an effective pretraining mixture.

 **Building on Proven Foundations** 

When it comes to pretraining data, the good news is that we rarely have to start from scratch. The open-source community has already built strong datasets for most common domains. Sometimes we will need to create something new — as we did with the Fine series (FineWeb, FineMath, etc.) — but more often, the challenge is in selecting and combining existing sources rather than reinventing them.

That was our situation with SmolLM3. SmolLM2 had already established a strong recipe at 1.7B parameters for English web data, and identified the best math and code datasets we had access to. Our goal was to scale that success to 3B while adding the certain capabilities: robust multilinguality, stronger math reasoning, and better code generation.

 **English Web Data: The Foundation Layer** 

Web text forms the backbone of any general-purpose LLM, but quality matters as much as quantity.

From SmolLM2, we knew that FineWeb-Edu and DCLM were the strongest open English web datasets. FineWeb-Edu helps on educational and  STEM benchmarks, while DCLM improves commonsense reasoning. Mixing them (around 60/40 or 50/50) gave the best trade-offs. We rerun the same ablations on our 3B model trained on 100B tokens and found the same conclusion.

 **Multilingual Web Data** 

Multilingual capability wasn’t in SmolLM2, so we started from scratch here. We selected the 15 target languages we wanted to support, from FineWeb2 and FineWeb2-HQ datasets which are the strongest open multilingual datasets. 

The key question was: how much of our web data should be non-English? As we know from scaling laws, the relationship is straightforward, the more data a model sees in a language or domain, the better it gets at that language or domain. The trade-off comes from our fixed compute budget: increasing data for one source means reducing data for others, which might hurt their performance, if there’s no knowledge transfer or if it’s negative. 

> [TODO]: elaborate and add ablations

Through ablations on the 3B model, we found that 12% multilingual content in the web mix struck the right balance, improving non-English performance without degrading English benchmarks. This fit SmolLM3’s expected usage, where English would remain the primary language. If we were targeting another language as a priority, we would run the same ablation process to find the proportion that maximizes its performance.

 **Code Data** 

For code, we began with The Stack v2 (16 languages) as our base. In the early stages, we focused on broad syntax and language coverage.

We delayed adding Stack-Edu — our educationally filtered subset of StarCoder2Data — until later stages, following the principle of staging high-quality data for maximum late-training impact.

Beyond just raw code files, we incorporated:

- StarCoder2 pull requests for real-world code review reasoning.
- Jupyter and Kaggle notebooks for executable, step-by-step workflows.
- GitHub issues and StackExchange threads for contextual discussions around code.
 **Math Data** 

Math followed a similar philosophy to code. Early on, we used the larger, more general sets FineMath3+ and InfiWebMath3+ and later we upsampled FineMath4+ and InfiWebMath4+, and introduced new high quality datasets:

- MegaMath
- Instruction and reasoning datasets like OpenMathInstruct and OpenMathReasoning
This sequencing ensured the model first learned math “vocabulary” before being pushed into more complex, reasoning-heavy tasks.

> [TODO]: summarize stage 1 data mixture

## Infrastructure - The unsung hero

When people talk about training LLMs, the conversation usually gravitates toward architectures, optimizers, and data mixtures. Infrastructure gets treated as a solved problem: rent some GPUs, install PyTorch, and you're good to go. But good infrastructure isn't just about having fast hardware, it's about building a system robust enough to survive the inevitable failures, automated enough to run without constant babysitting, and flexible enough to adapt when things go wrong.
For SmolLM3, we trained on 384 H100s for nearly a month, processing 11 trillion tokens. During that time, we dealt with node failures, storage issues and run restarts. In this section, we’ll look at how to prepare for these issues and keep training smooth and low-maintenance.

###  **Hardware (nouamane)** 

- GPU options: H100s, A100s, performance and cost trade-offs (TPUs?)
- How many GPUs do you actually need?
- Network requirements: InfiniBand vs Ethernet for multi-node training
- Storage architecture: fsx, Weka, scratch, s3 (explanation will be needed for the training marathon section)
###  **Software (nouamane)** 

- frameworks covered in ablation section
- Parallelism strategies: Data parallel, tensor parallel, pipeline parallel (recap and refer to ultra scale blog)
- Mixed precision: FP16, BF16, FP8 trade-offs and hardware support
- SmolLM3: TP=2, DP=192, micro batch size=3 - the reasoning behind these choices
add metrics to monitor in the next section

### Throughput optimization (nouamane)

###  **Training Infrastructure Fundamentals** 

Having fast hardware is just the entry ticket. To go from a training amateur to a professional, we need to think beyond raw speed and focus on the less glamorous but critical infrastructure pieces that make the entire training experience smoother and with minimal downtime.

####  **Checkpoint Management** 

Checkpoints are our safety net during long training runs. We save them regularly for three practical reasons: recovering from failures, monitoring training progress through evaluation and sharing intermediate models with the community for research. The recovery aspect matters most. If our run fails, we want to restart from the latest saved checkpoint so we lose at most the save interval if we resume immediately (e.g., 4 hours of training if we save every 4 hours).

Pro tip:  **automate your resume process** . On Slurm, for example, you can you can just use  `SBATCH --requeue`  so the job restarts automatically from the latest checkpoint. That way, you avoid losing time waiting for someone to notice the failure and manually restart.

There’s two important details to keep in mind when implementing your resume mechanism:

- Checkpoint saving should happen in the background without impacting training throughput.
- Watch your storage, over a 24-day run, saving every 4 hours means ~144 checkpoints. With large models and optimizer states, this adds up fast. In our case, we store only one local checkpoint (the latest saved) at a time and offload the rest to S3 to avoid filling up cluster storage.
 **A painful lesson from the past:** 

During our first large-scale run (StarCoder 15B), training proceeded smoothly through multiple restarts. On the final day, we discovered the entire checkpoint folder had been deleted by a leftover  `rm -rf $CHECKPOINT_PATH`  command from old throughput tests. This destructive command only triggered when the Slurm job actually finished, which hadn't happened in previous restarts.

Luckily, we had the checkpoint from the day before saved, so it only cost us one day of retraining. The takeaways were clear: never leave destructive commands in production scripts, and automate checkpoint backups immediately after saving rather than relying on manual intervention.

In our nanotron trainings, we save checkpoints every 2 hours locally, immediately upload each one to S3, then delete the local copy once backup is confirmed. On resume, we pull from S3 if the latest checkpoint isn't available locally. This approach saves storage, ensures backups, and enables quick recovery.

####  **Automated Evaluations** 

Evaluations are deceptively time-consuming. Even with everything implemented, running them manually, logging results, and making plots can eat up hours each time.

The best time-saver? Automate them completely.

For SmolLM3, we use [LightEval](https://github.com/huggingface/lighteval) to run evaluations on nanotron checkpoints. Every saved checkpoint triggers an evaluation job on the cluster. The results are pushed directly to Weights & Biases, so we just open the dashboard and watch the curves evolve. This saved us a huge amount of time and kept eval tracking consistent throughout the run.

If you can automate only one thing in your training setup, automate evaluations.

####  **Node Health Monitoring and Replacement** 

Having enough fast GPUs is important for training, but since LLM trainings run for weeks or months rather than single days, tracking GPU health over time becomes critical. GPUs that pass initial benchmarks can develop thermal throttling, memory errors, or performance degradation during extended training runs. In this section, we will share how we approach this challenge and the tools we use.

 **Upfront tests:**  Before launching SmolLM3, we ran [GPU Fryer](https://github.com/huggingface/gpu-fryer), an internal tool that stress-tests GPUs for thermal throttling, memory errors, and performance anomalies. This caught two problematic GPUs that would have caused issues during training.
 **Node reservation:** Because SmolLM3 was trained on a Slurm managed cluster, we booked a fixed 48-node reservation for the entire run. This setup allowed us to track the health and performance of the exact same nodes over time, it was also necessary to solve a data storage issue we will talk about later. We also reserved a spare node — like a car’s spare wheel — so if one failed, we could swap it in immediately without waiting for repairs. While idle, the spare node ran eval jobs or dev experiments.

 **Continuous monitoring:**  During training, we tracked key metrics across all nodes such as GPU temperatures, memory usage, compute utilization and throughput fluctuations. A Slack bot alerted us when any node showed suspicious behavior, allowing us to proactively replace failing hardware before it crashed the entire training run.

> [TODO]: add grafana screenshot and mention other metrics

This multi-layered approach meant hardware issues became manageable interruptions.

@Anonymous could you add a section on which hardware and software metrics to monitor

## The training marathon

You’ve made it this far, congrats! The real fun is about to begin.

At this point, we have everything in place: a validated architecture, a finalized data mixture, tuned hyperparameters, and infrastructure ready to go. The only thing left is to hit “train”.

It’s a bit like setting off on a long road trip. We might have a perfect itinerary, but before we pull out of the driveway, we still check the car’s engine, tires, and fuel. LLM training is the same, even with all the prep work, there’s still a final round of sanity checks that can save us from unpleasant surprises mid-run.

Our team has been through this many times — from StarCoder and StarCoder2, to SmolLM, SmolLM2, and now SmolLM3. Every single run is different. Even if you’ve trained a dozen models, each new run finds a fresh way to surprise you. This section is about stacking the odds in your favor so you’re ready for those surprises.

### Pre-flight checklist: What to verify before hitting "train"

Before hitting “train”, we go through a checklist to ensure everything works end-to-end:

 **Infrastructure readiness:**  If your cluster supports reservations, use them. For SmolLM3, we had a fixed 48-node reservation for the entire run. That meant no queueing delays, consistent throughput, and the ability to track node health over time. 

- Stress-test GPUs before launch (we use GPU Fryer) to catch throttling or performance degradation. For SmolLM3, we found two GPUs throttling and replaced them before starting.
- Avoid storage bloat: our system uploads each checkpoint to S3, then deletes the local copy before saving the next one, so we never store more than one locally.
 **Evaluation setup:** Ensure your automated evaluations are running and logging correctly. This is worth testing  *before*  the training starts.

 **Checkpoint & auto-resume system:**  Verify that checkpoints save correctly and that the training job can resume from the latest one without manual intervention. On Slurm, we use job arrays so that if one job fails, the next starts automatically, resuming from the most recent checkpoint.

 **Metrics logging:**  Confirm that you’re logging all the metrics you care about: evaluation scores

throughput (tokens/sec), training loss, gradient norm, and any custom debug metrics for the run.

 **Training configuration sanity check:** Double-check your training config, launch scripts, and Slurm submission commands.

### Scaling surprises 

(improved version of this section using d3 and trackio plots in:  [https://huggingface.co/spaces/HuggingFaceTB/smolllm-blog-draft](https://huggingface.co/spaces/HuggingFaceTB/smolllm-blog-draft) )

> loubna: maybe we could even add some slack screenshots to make it more authentic ?

Our 3B ablations on 100B tokens looked promising. The architectural changes compared to SmolLM2 (GQA, NoPE, document masking, tokenizer) either improved or maintained performance, and we found a good data mixture that balances English, multilingual, code, and math performance. We optimized our configuration for around 30% MFU on 384 GPUS (48 nodes).

We were ready for the big one: 11T tokens. That’s when reality started throwing curveballs.

####  **Mystery #1 – The vanishing throughput** 

Within hours of launch, throughput plummeted. It was a big jump with repeated sharp drops.

![Image](/media/27877f1c9c9d804d9c82f7b3905578ff/image_27877f1c-9c9d-808d-9c6d-fae817ac8868.png)

This didn’t happen in any ablation run, so what changed? Three things:

1. Hardware can develop issues, GPUs that worked fine in ablations might fail and network connections might degrade under sustained load.
1. We were now training on the full dataset instead of subsets: ~24 TB spanning dozens of web, code, math, and multilingual sources.
1. We set the real step count for 11T tokens instead of the short 100B-token ablation horizon.
Intuitively, neither dataset size nor step count should cause throughput drops, so we naturally suspected hardware issues first. We checked our node monitoring metrics, which showed that the big throughput jump correlated with spikes in node read latency. That pointed us straight at our storage: Weka.

If you remember the hardware section of the previous chapter, our cluster uses Weka for storage. It has a "keep-hot" caching model that stores frequently accessed files on fast local storage while automatically evicting inactive "cold" files to S3 as capacity fills up. With 24TB of training data, we were pushing Weka’s storage to the limit. So it started evicting dataset shards mid-training, which meant we had to fetch them back, creating stalls, which explained the big throughput jump. Worse: there was no way to pin our dataset folders as hot for the full training.

 **Fix #1 – Changing data storage** 

We didn't find a way to pin our dataset folders as hot for the full training in Weka, so we tried to change the storage method. Streaming directly from S3 was slow, so we decided to store the data in each node in its local storage  `/scratch` .

This came with a catch: If a node died and was replaced, the new replacement GPUs had no data. Downloading 24TB from S3 with  `s5cmd`  took 3h. We cut that to 1h30 by copying from another healthy node using  `fpsync`  instead of going through S3. This was faster given all the nodes were in the same datacenter.

Still, 1h30 of downtime per node failure, and the need for manually copying the data to the new node immediately, was painful. The hack that finally made it bearable: reserve a spare node in our Slurm reservation with the dataset preloaded. If a node died, we swapped it instantly with the spare node, so zero recovery delay. While idle, the spare ran evals or dev jobs, so it wasn’t wasted.

This fixed Mystery #1… or so we thought.

####  **Mystery #2 – The persisting throughput drops** 

Even after moving to scratch, the individual throughput drops kept happening although we didn’t find any anomaly in the hardware monitoring metrics.

> todo: use better plots

![Image](/media/27877f1c9c9d804d9c82f7b3905578ff/image_27877f1c-9c9d-8031-ac8d-c5678af1bdd5.png)

Still suspecting hardware, we decided to test on fewer nodes. With 384 GPUs, there's a high chance something could be failing. Surprisingly, we could reproduce the exact same throughput drops on a single node, no matter which specific node we tested. This ruled out hardware issues.

Remember the three things that changed from our ablations? We had already addressed the data storage issue by moving to local node storage. Hardware was now eliminated. That left only one variable: the step count. We tested this by rolling back to smaller step counts (from 3M to 32k) and the thoughput drops became smaller! Larger step counts produced sharper, more frequent drops.

Remember the three things that changed from our ablations? We had already addressed the data storage issue by moving to local node storage. Hardware was now eliminated. That left only one variable: the step count.

To test this, we ran identical configurations with only the training steps changed from 32k to 3.2M. You can see the [exact configs we used](https://huggingface.co/datasets/HuggingFaceTB/ablations-training-configs/tree/main/throughput_debugging):

```diff
## Short run (32k steps)
- "lr_decay_starting_step": 2560000
- "lr_decay_steps": 640000
- "train_steps": 3200000

## Long run (3.2M steps)
+ "lr_decay_starting_step": 26000
+ "lr_decay_steps": 6000
+ "train_steps": 32000
```
The results shown in the figure below were clear: shorter runs had small throughput drops, while longer step counts produced sharper, more frequent drops. So the issue was not the hardware, but a software bottleneck, likely in the dataloader! Given that most other training components process each batch identically regardless of step count.

![Image](/media/27877f1c9c9d804d9c82f7b3905578ff/image_27877f1c-9c9d-8075-ae2e-dc24fe9296ca.png)

That's when we realized we'd never actually done large-scale pretraining with nanotron's dataloader. SmolLM2 had been trained with steady throughput using a Megatron-LM derived dataloader ([TokenizedBytes](https://github.com/huggingface/nanotron/blob/7bc9923285a03069ebffe994379a311aceaea546/src/nanotron/data/tokenized_bytes.py#L80)) through an internal wrapper around nanotron. For SmolLM3, we switched to nanotron's built-in dataloader ( `nanosets` ).

After deep diving into its implementation, we found that it was naively building one giant index that grew with each training step. For very large steps, this caused a higher shared memory which triggered throughput drops.

 **Fix #2 – Bring in TokenizedBytes dataloader** 

To confirm that the dataloader was indeed the culprit, we launched the same configuration with our internal SmolLM2 framework using  `TokenizedBytes`  dataloader. No drops. Even on 48 nodes using the same datasets.

Fastest path forward: copy this dataloader into nanotron. The drops were gone and the throughput back to target.

We were ready to relaunch… until the next curveball.

####  **Mystery #3 – The noisy loss** 

With the new dataloader, we didn’t have throughput drops but the loss curve looked more noisy.

> todo: find the loss plot

 `nanosets`  had been producing smoother loss, and the difference rang a bell from an old debugging war: a few years ago, we’d found a shuffling bug in our pretraining code where documents were shuffled, but sequences inside a batch were not, leading to small spikes. 

Checking our new dataloader confirmed it: it was reading sequences sequentially from each document. That’s fine for short files, but with domains like code, a single long low-quality file can fill an entire batch and cause loss spikes.

 **Fix #3 – Shuffle at the sequence level** 

We had two options:

1. Change the dataloader to do random access (risk: higher memory usage).
1. Pre-shuffle tokenized sequences offline.
With the time pressure to start the run and our cluster reservation running, we went with option #2 as the safer, faster fix. Tokenized data was already on each node, so reshuffling locally was cheap (~1 h). We also generated shuffled sequences for each epoch with different seeds to avoid repeating shuffling patterns across epochs.

####  **Launch, Take Two** 

By now we had:

-  **Stable throughput**  (scratch storage + spare node strategy)
-  **No step-count-induced drops**  ( `TokenizedBytes`  dataloader)
-  **Clean, sequence-level shuffling**  (offline pre-shuffle per epoch)
We relaunched. This time, everything held. The loss curve was smooth, throughput was consistent, and we could finally focus on training instead of firefighting.

 **Mystery #4 – Unsatisfactory performance** 

After fixing the throughput and dataloader issues, we launched the run again and trained smoothly for the first two days. Throughput was stable, loss curves looked as expected, and nothing in the logs suggested any problems. At around the 1T token mark, however, the evaluations revealed something unexpected.

As part of our monitoring, we evaluate intermediate checkpoints and compare them to historical runs. For instance, we had the intermediate checkpoints from SmolLM2 (1.7B) trained on a similar recipe, so we could track how both models progressed at the same stages of training. The results were puzzling: despite having more parameters and a better data mixture, the 3B model was performing worse than the 1.7B at the same training point. Loss was still decreasing, and benchmark scores were improving, but the improvement rate was clearly below expectations.

Given that we had thoroughly tested every architecture and data change introduced in SmolLM3 compared to SmolLM2, we validated the training framework and there were only a few remaining untested differences between the two training setups. The most obvious was tensor parallelism. SmolLM2 could fit on a single GPU and was trained without TP, while SmolLM3 required TP=2 to fit in memory. We didn’t suspect it or think of testing it before, since TP was used in the 3B ablations and their results made sense.

 **Fix #4 - The final fix** 

To test the TP bug hypothesis, we trained a 1.7B model with the exact same setup as SmolLM3 — same architecture changes (document masking, NoPE), same data mixture, same hyperparameters — both with and without TP. The difference was immediate: the TP version consistently had a higher loss and lower downstream performance than the non-TP version. That confirmed we were looking at a TP-related bug.

We then examined the TP implementation in detail, comparing weights from TP and non-TP runs. The problem turned out to be subtle but significant: we were using identical random seeds across all TP ranks, when each rank should have been initialized with a different seed. This caused correlated weight initialization across shards, which affected convergence. The effect was not catastrophic — the model still trained and improved — but it introduced enough inefficiency to explain the gap we observed at scale.
Below is the bug fix:

```diff
diff --git a/src/nanotron/trainer.py b/src/nanotron/trainer.py
index 1234567..abcdefg 100644
--- a/src/nanotron/trainer.py
+++ b/src/nanotron/trainer.py
@@ -185,7 +185,10 @@ class DistributedTrainer:
     ):
         # Set random states
-        set_random_seed(self.config.general.seed)
+        # Set different random seed for each TP rank to ensure diversity
+        tp_rank = dist.get_rank(self.parallel_context.tp_pg)
+        set_random_seed(self.config.general.seed + tp_rank)
+
```
![Image](/media/27877f1c9c9d804d9c82f7b3905578ff/image_27877f1c-9c9d-8048-9b7e-db4fa7485915.png)

Once we fixed the seeds so that each TP rank used a different seed, we repeated the ablations experiments and confirmed that TP and non-TP runs now matched in both loss curves and downstream performance. To make sure there were no other hidden issues, we ran additional sanity checks: a SmolLM2-style (architecture and data wise) run at 3B parameters, and a separate SmolLM3 run at 3B parameters, comparing both to SmolLM2’s checkpoints. The results now aligned with expectations: the 1.7B SmolLM2 performed worse than the 3B SmolLM2 variant, which in turn was below SmolLM3’s 3B performance.

![Image](/media/27877f1c9c9d804d9c82f7b3905578ff/image_27877f1c-9c9d-80e7-a500-fb79cebde7e3.png)

This debugging process reinforced one of the core principles we outlined earlier in this blog: 

“The real value of a solid ablation setup goes beyond just building a good model. When things inevitably go wrong during our main training run (and they will, no matter how much we prepare), we want to be confident in every decision we made and quickly identify which components weren't properly tested and could be causing the issues. This preparation saves debugging time and keeps our sanity intact. There's nothing worse than staring at a mysterious training failure with no idea where the bug could be hiding.”

Because every other component in our training had been validated, we could pinpoint TP as the only plausible cause and fix the bug within a single day of detecting the performance gap.

With that, we had resolved the last in a series of unexpected issues that had surfaced since launch. Third time’s a charm, from that point on, the remaining month of training was relatively uneventful, just the steady work of turning trillions of tokens into a finished model, interrupted by occasional restarts due to node failures.

### Staying the course

As the previous section showed, scaling from ablations to full pretraining wasn't just “plug and play.” unexpected challenges, it brought unexpected challenges, but we successfully identified and resolved each issue. This section covers the essential monitoring setup and considerations for large-scale training runs. We'll address critical questions: When should you restart training after encountering problems? How do you handle issues that surface deep into a run? Which metrics truly matter? Should you maintain a fixed data mixture throughout training?

#### Training monitoring: Beyond loss curves

The reason we caught the tensor-parallelism bug was not the loss curve, which it looked fine, but the fact that downstream evaluations were lagging behind expectations. Additionally, having evaluations from SmolLM2’s intermediate checkpoints was critical: they gave us a sanity check that the 3B model wasn’t on the right track early. So if you’re training large models, start running downstream evaluations early, and if you’re comparing to an open-source model, ask whether they provide intermediate checkpoints, those can be invaluable as reference points.

On the infrastructure side, the single most important metric is throughput, measured in tokens per second. For SmolLM3, we expected stable throughput between  **13,500–14,000 tokens/sec**  across the run, and any sustained deviation was a red flag. But throughput alone is not enough: you also need continuous hardware health monitoring to anticipate and detect hardware failures. Some of the key metrics we tracked included: GPU utilization, GPU temperature and thermal throttling, memory errors, network health, host-level metrics (CPU load, RAM usage, I/O wait). We log them into Grafana dashboards and set up real-time Slack alerts for hardware anomalies.

#### Fix and restart vs fix on the fly

Given that we restarted our run after 1T tokens, an important question arises: do you always need to restart when something goes wrong? The answer depends on the severity and root cause of the issue.

In our case, the TP seeding bug meant we were starting on the wrong foot, half our weights were effectively duplicated due to the initialization issue. The model was showing performance similar to SmolLM2 and plateauing at similar points, meaning we'd likely end up with a model that performed the same but cost twice as much to train. Restarting made sense. However, many issues can be course-corrected mid-run to avoid wasting compute. The most common issue involves loss spikes, those sudden jumps in training loss that can either signal minor hiccups or divergence.

Loss spikes fall into two categories:

- Recoverable spikes: These can recover either fast (immediately after the spike) or slow (requiring several more training steps to return to the pre-spike trajectory). You can usually continue training through these. If recovery is very slow, you can try rewinding to a previous checkpoint to skip problematic batches.
- Non-recoverable spikes: The model either diverges or plateaus at worse performance than before the spike. These require more significant intervention than simply rewinding to a previous checkpoint.
> TODO: add examples of the recoverable spikes from smollm2 and non recoverable from a muon ablation

While we don't fully understand training instabilities, we know  they become more frequent at scale. Common culprits, assuming a conservative architecture and optimizer, include:

-  **High learning rates** : These cause instability early in training and can be fixed by reducing the learning rate.
-  **Bad data** : Usually the main cause of recoverable spikes, though recovery may be slow. This can happen deep into training when the model encounters low-quality data. 
-  **Data-parameter state interactions** : PaLM observed that spikes often result from specific combinations of data batches and model parameter states, rather than "bad data" alone. Training on the same problematic batches from a different checkpoint didn't reproduce the spikes.
-  **Poor initialization** : Recent work by OLMo2 showed that switching from scaled initialization to a simple normal distribution (mean=0, std=0.02) improved stability.
-  **Precision issues** : While no one trains with FP16 anymore, [BLOOM](https://arxiv.org/abs/2211.05100) found it highly unstable compared to BF16.
 **Before spikes happen - build in stability:** 

Small models with conservative learning rates and good data rarely spike, but larger models require proactive stability measures. As more teams have trained at scale, we've accumulated a toolkit of techniques that help prevent training instability:

Data filtering and shuffling: By this point in the blog, you've noticed how often we circle back to data. Making sure your data is clean and well-shuffled can prevent spikes. For instance, OLMo2 found that removing documents with repeated n-grams (32+ repetitions of 1-13 token spans) significantly reduced spike frequency.

Training modifications: Z-loss regularization keeps output logits from growing too large without affecting performance. And excluding embeddings from weight decay also helps.

Architectural changes: QKNorm (normalizing query and key projections before attention) has proven effective. OLMo2 and other teams found it helps with stability, and interestingly, [Marin team](https://wandb.ai/marin-community/marin/reports/Marin-32B-Work-In-Progress--VmlldzoxMzM1Mzk1NQ) found that it can even be applied mid-run to fix divergence issues. 

> [TODO]: mention QK-norm might hurt long context and cite [https://arxiv.org/abs/2501.18795](https://arxiv.org/abs/2501.18795)

> [TODO]: cite: [https://arxiv.org/pdf/2410.16682](https://arxiv.org/pdf/2410.16682) stability tricks that allow increasing lr + add some technical explanations

 **When spikes happen anyway - damage control:** 

Even with all these precautions, spikes can still occur. Here are some options for fixing them:

-  **Skip problematic batches** : Rewind to before the spike and skip the problematic batches. This is the most common fix for spikes. The [Falcon team](https://arxiv.org/abs/2311.16867) skipped 1B tokens to resolve their spikes, while the [PaLM team](https://arxiv.org/pdf/2204.02311#page=10.09) found that skipping 200-500 batches around the spike location prevented recurrence.
-  **Tighten gradient clipping** : Reduce the gradient norm threshold temporarily
-  **Apply architectural fixes**  such as QKnorm, as done in Marin.
#### Intervention strategies: When and how to adjust data mixture

- When to change mixture
- The three-stage approach: Why we increase math/code ratios over time
- How to change the mixture: annealing ablations
### Mid-training

#### Stage 2 and stage 3 mixtures

- Ablation results and evaluation of new datasets (MegaMath, instruct data..)
- Performance tracking: ensuring improvements at each stage
#### Long context extension: From 4k to 128k tokens

- Sequential approach: 4k→32k→64k context length increases
- Evaluation: Helmet and Ruler
- Data ablations
- RoPE theta adjustments: 1.5M and 5M values and their impact
- Data upsampling: Math, code, and reasoning data emphasis
- YARN extrapolation: Going beyond training length to 128k inference
#### Reasoning mid-training

- Dataset selection: OpenThoughts3-1.2M and Nemotron reasoning traces
- ChatML: Template choice and wrapping strategy
- Training approach: 4 epochs on 140B tokens, checkpoint selection for SFT