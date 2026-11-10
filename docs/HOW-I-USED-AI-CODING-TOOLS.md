# How I used AI coding tools

This repository was built as a focused proof of concept. I used AI coding assistants the way I
use them on delivery work:

1. **Break the problem down first.** Multi-tenancy, a connector SDK, a canonical model, insights,
   and a static-demo constraint were written down before any scaffolding. The assistants helped
   turn that outline into files, not the other way around.
2. **Generate the boring parts, keep the design.** Boilerplate (NestJS module wiring, Vite config,
   Jest setup, Firebase hosting JSON) is a good fit for generation. The isolation rules, the
   ingest fingerprint, the anomaly thresholds and the assistant fallback were specified and then
   reviewed line by line.
3. **Tests as the review checklist.** Normalisation, tenant isolation, idempotent replay, webhook
   signatures and insight flags all have unit tests. When generated code drifted (for example
   treating a major-unit price as already-minor), the tests caught it.
4. **Nothing confidential, no keys.** Sample guests and employees are labelled `(sample)`. Demo
   API keys are fixtures. No customer data and no real webhook secrets were pasted into a prompt
   or committed.

I would use the same split on a production team: assistants accelerate scaffolding and first-pass
tests; architecture, security review and the merge decision stay human.
