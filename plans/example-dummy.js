// EXAMPLE plan — not listed in plans/index.js by default.
registerPlan({
 "id": "example-dummy",
 "name": "EXAMPLE \u2014 Dummy plan (for testing)",
 "credit": "Example plan.",
 "warmup": [
  {
   "id": "wu0",
   "name": "Jog in place",
   "dose": {
    "text": "60 s"
   },
   "tempo": "Easy",
   "note": "Example note."
  }
 ],
 "days": {
  "0": {
   "label": "Example day",
   "exercises": [
    {
     "id": "x0",
     "name": "Example squat",
     "dose": {
      "sets": 2,
      "lo": 10,
      "hi": 10,
      "unit": "reps",
      "suffix": ""
     },
     "tempo": "2 s down",
     "note": "Example cue. Mistake: example."
    }
   ],
   "text": ""
  },
  "1": {
   "label": "Example day",
   "exercises": [
    {
     "id": "x1",
     "name": "Example squat",
     "dose": {
      "sets": 2,
      "lo": 10,
      "hi": 10,
      "unit": "reps",
      "suffix": ""
     },
     "tempo": "2 s down",
     "note": "Example cue. Mistake: example."
    }
   ],
   "text": ""
  },
  "2": {
   "label": "Example day",
   "exercises": [
    {
     "id": "x2",
     "name": "Example squat",
     "dose": {
      "sets": 2,
      "lo": 10,
      "hi": 10,
      "unit": "reps",
      "suffix": ""
     },
     "tempo": "2 s down",
     "note": "Example cue. Mistake: example."
    }
   ],
   "text": ""
  },
  "3": {
   "label": "Example day",
   "exercises": [
    {
     "id": "x3",
     "name": "Example squat",
     "dose": {
      "sets": 2,
      "lo": 10,
      "hi": 10,
      "unit": "reps",
      "suffix": ""
     },
     "tempo": "2 s down",
     "note": "Example cue. Mistake: example."
    }
   ],
   "text": ""
  },
  "4": {
   "label": "Example day",
   "exercises": [
    {
     "id": "x4",
     "name": "Example squat",
     "dose": {
      "sets": 2,
      "lo": 10,
      "hi": 10,
      "unit": "reps",
      "suffix": ""
     },
     "tempo": "2 s down",
     "note": "Example cue. Mistake: example."
    }
   ],
   "text": ""
  },
  "5": {
   "label": "Example day",
   "exercises": [
    {
     "id": "x5",
     "name": "Example squat",
     "dose": {
      "sets": 2,
      "lo": 10,
      "hi": 10,
      "unit": "reps",
      "suffix": ""
     },
     "tempo": "2 s down",
     "note": "Example cue. Mistake: example."
    }
   ],
   "text": ""
  },
  "6": {
   "label": "Example day",
   "exercises": [
    {
     "id": "x6",
     "name": "Example squat",
     "dose": {
      "sets": 2,
      "lo": 10,
      "hi": 10,
      "unit": "reps",
      "suffix": ""
     },
     "tempo": "2 s down",
     "note": "Example cue. Mistake: example."
    }
   ],
   "text": ""
  }
 },
 "progression": {
  "progressDays": [
   0,
   1,
   2,
   3,
   4,
   5,
   6
  ],
  "maxSets": 3,
  "harderAfterSessions": 2,
  "weeks": [
   {
    "week": 1,
    "holdAdd": 0,
    "repAdd": 0,
    "setAdd": 0,
    "summary": "Base."
   },
   {
    "week": 2,
    "holdAdd": 0,
    "repAdd": 2,
    "setAdd": 0,
    "summary": "+2 reps."
   }
  ],
  "text": []
 },
 "retest": {
  "everyWeeks": 2,
  "items": [
   "Example retest"
  ]
 },
 "safety": [
  "Example safety line."
 ]
});
