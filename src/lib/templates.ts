/** Static questionnaire templates used by the public /templates pages.
 *  Each template doubles as a seed prompt for the generator. */

export type TemplateItem = { text: string; subscale: string; reverse: boolean };

export type QuestionnaireTemplate = {
  slug: string;
  title: string;
  audience: string;
  summary: string;
  metaTitle: string;
  metaDescription: string;
  scale: { min: number; max: number; labels: string[] };
  method: "sum" | "mean";
  subscales: string[];
  items: TemplateItem[];
  bands: { name: string; range: string; text: string }[];
  scoringNotes: string[];
  prompt: string;
};

const AGREE_5 = {
  min: 1,
  max: 5,
  labels: ["Strongly disagree", "Disagree", "Neither", "Agree", "Strongly agree"],
};

export const TEMPLATES: QuestionnaireTemplate[] = [
  {
    slug: "employee-engagement-questionnaire",
    title: "Employee engagement questionnaire",
    audience: "HR and people teams",
    summary:
      "A 12-item engagement check covering pride in the work, day-to-day energy and intent to stay, scored as three subscale means.",
    metaTitle: "Employee engagement questionnaire template (12 items, with scoring)",
    metaDescription:
      "A free 12-item employee engagement questionnaire template with a 5-point agreement scale, reverse-scored items, subscale means and score-range wording you can reuse.",
    scale: AGREE_5,
    method: "mean",
    subscales: ["Pride", "Energy", "Retention"],
    items: [
      { text: "I would recommend this organisation as a good place to work.", subscale: "Pride", reverse: false },
      { text: "I understand how my work contributes to the wider goals.", subscale: "Pride", reverse: false },
      { text: "I rarely feel proud of what my team produces.", subscale: "Pride", reverse: true },
      { text: "I have the resources I need to do my job well.", subscale: "Pride", reverse: false },
      { text: "I usually finish the week with energy left over.", subscale: "Energy", reverse: false },
      { text: "My workload feels unsustainable most weeks.", subscale: "Energy", reverse: true },
      { text: "I can concentrate on meaningful work without constant interruption.", subscale: "Energy", reverse: false },
      { text: "I feel drained before the working day begins.", subscale: "Energy", reverse: true },
      { text: "I expect to still be working here in a year.", subscale: "Retention", reverse: false },
      { text: "I have recently thought seriously about leaving.", subscale: "Retention", reverse: true },
      { text: "I can see a realistic path to grow here.", subscale: "Retention", reverse: false },
      { text: "My manager gives feedback I can act on.", subscale: "Retention", reverse: false },
    ],
    bands: [
      { name: "Low", range: "1.0 – 2.4", text: "Responses point to weak engagement on this dimension; treat it as a priority area to explore in conversation." },
      { name: "Moderate", range: "2.5 – 3.7", text: "A mixed picture — some drivers are working and others are not. Look at the individual items rather than the average." },
      { name: "High", range: "3.8 – 5.0", text: "Responses point to strong engagement on this dimension. Worth understanding what is working so it can be protected." },
    ],
    scoringNotes: [
      "Reverse-scored items use new = (max + min) − raw, so on a 1–5 scale a raw 2 becomes a 4.",
      "Each subscale is the mean of its own items, reported separately — there is no single engagement number.",
      "Run it anonymously and report subscale means at team level, not per person.",
    ],
    prompt:
      "Build a 12-item employee engagement questionnaire for HR teams with three subscales (Pride, Energy, Retention), a 5-point agreement scale, several reverse-scored items, mean scoring per subscale and low/moderate/high score-range wording.",
  },
  {
    slug: "course-feedback-questionnaire",
    title: "Course feedback questionnaire",
    audience: "Educators and course creators",
    summary:
      "A 12-item end-of-course questionnaire separating clarity of teaching, workload fit and perceived usefulness.",
    metaTitle: "Course feedback questionnaire template (12 items, with scoring)",
    metaDescription:
      "A free 12-item course feedback questionnaire template with a 5-point agreement scale, reverse-scored items, three subscales and ready score-range wording for educators.",
    scale: AGREE_5,
    method: "mean",
    subscales: ["Clarity", "Workload", "Usefulness"],
    items: [
      { text: "The learning goals for this course were clear to me.", subscale: "Clarity", reverse: false },
      { text: "Explanations were easy to follow.", subscale: "Clarity", reverse: false },
      { text: "I was often unsure what I was supposed to be learning.", subscale: "Clarity", reverse: true },
      { text: "Materials were well organised and easy to find.", subscale: "Clarity", reverse: false },
      { text: "The amount of work was reasonable for the time available.", subscale: "Workload", reverse: false },
      { text: "The pace was too fast for me to keep up.", subscale: "Workload", reverse: true },
      { text: "Deadlines were spaced sensibly.", subscale: "Workload", reverse: false },
      { text: "I had to rush work I would rather have done properly.", subscale: "Workload", reverse: true },
      { text: "I can apply what I learned outside this course.", subscale: "Usefulness", reverse: false },
      { text: "The assessments reflected what was actually taught.", subscale: "Usefulness", reverse: false },
      { text: "Much of the content felt irrelevant to me.", subscale: "Usefulness", reverse: true },
      { text: "I would take another course taught this way.", subscale: "Usefulness", reverse: false },
    ],
    bands: [
      { name: "Needs work", range: "1.0 – 2.4", text: "This dimension is dragging the course experience down; review the lowest-scoring items first." },
      { name: "Acceptable", range: "2.5 – 3.7", text: "Broadly working, with clear room to improve. Compare against previous cohorts if you have them." },
      { name: "Strong", range: "3.8 – 5.0", text: "Learners rate this dimension well. Keep the structure that produced it." },
    ],
    scoringNotes: [
      "Score each subscale as the mean of its items so a strong topic cannot mask a workload problem.",
      "Reverse-score the negatively worded items before averaging.",
      "Collect it once at the end and, if possible, once mid-course so you can act while it still matters.",
    ],
    prompt:
      "Build a 12-item end-of-course feedback questionnaire for educators with three subscales (Clarity, Workload, Usefulness), a 5-point agreement scale, reverse-scored negative items, mean scoring and needs-work/acceptable/strong score-range wording.",
  },
  {
    slug: "wellbeing-check-in-questionnaire",
    title: "Wellbeing check-in questionnaire",
    audience: "Coaches and team leads",
    summary:
      "A 12-item non-clinical check-in on energy, sleep routine and social connection, written for coaching conversations.",
    metaTitle: "Wellbeing check-in questionnaire template (12 items, non-clinical)",
    metaDescription:
      "A free 12-item non-clinical wellbeing check-in questionnaire template with a 5-point scale, reverse-scored items, three subscales and score-range wording for coaches.",
    scale: AGREE_5,
    method: "mean",
    subscales: ["Energy", "Routine", "Connection"],
    items: [
      { text: "I have felt physically up to my usual activities.", subscale: "Energy", reverse: false },
      { text: "I have felt worn out by mid-afternoon.", subscale: "Energy", reverse: true },
      { text: "I have been able to focus on one thing at a time.", subscale: "Energy", reverse: false },
      { text: "Small tasks have felt heavier than usual.", subscale: "Energy", reverse: true },
      { text: "I have kept a fairly regular sleep schedule.", subscale: "Routine", reverse: false },
      { text: "My eating pattern has been irregular.", subscale: "Routine", reverse: true },
      { text: "I have moved my body most days.", subscale: "Routine", reverse: false },
      { text: "I have taken proper breaks away from screens.", subscale: "Routine", reverse: false },
      { text: "I have spent time with people I enjoy.", subscale: "Connection", reverse: false },
      { text: "I have kept to myself more than I would like.", subscale: "Connection", reverse: true },
      { text: "There is someone I could talk to about something difficult.", subscale: "Connection", reverse: false },
      { text: "I have felt part of a group that matters to me.", subscale: "Connection", reverse: false },
    ],
    bands: [
      { name: "Low", range: "1.0 – 2.4", text: "This area has been hard lately. It is a conversation starter, not a finding — encourage professional support where appropriate." },
      { name: "Mixed", range: "2.5 – 3.7", text: "Some days work and others do not. Look at which specific items sit lowest." },
      { name: "Steady", range: "3.8 – 5.0", text: "This area has been holding up well over the period asked about." },
    ],
    scoringNotes: [
      "This is a self-report check-in for reflection and coaching. It is not a clinical or diagnostic instrument.",
      "Anchor the wording to a period (\"over the past two weeks\") so repeat scores are comparable.",
      "Report subscales separately; a single wellbeing number hides which area needs attention.",
    ],
    prompt:
      "Build a 12-item non-clinical wellbeing check-in questionnaire for coaching conversations with three subscales (Energy, Routine, Connection), a 5-point agreement scale anchored to the past two weeks, reverse-scored items, mean scoring, low/mixed/steady score-range wording and an explicit non-diagnostic disclaimer.",
  },
  {
    slug: "customer-satisfaction-questionnaire",
    title: "Customer satisfaction questionnaire",
    audience: "Founders and support teams",
    summary:
      "A 12-item post-purchase questionnaire splitting product fit, support experience and loyalty into separate scores.",
    metaTitle: "Customer satisfaction questionnaire template (12 items, with scoring)",
    metaDescription:
      "A free 12-item customer satisfaction questionnaire template with a 5-point agreement scale, reverse-scored items, three subscales and score-range wording you can reuse.",
    scale: AGREE_5,
    method: "mean",
    subscales: ["Product fit", "Support", "Loyalty"],
    items: [
      { text: "The product does what I expected it to do.", subscale: "Product fit", reverse: false },
      { text: "It was easy to get started.", subscale: "Product fit", reverse: false },
      { text: "I regularly hit limitations that get in my way.", subscale: "Product fit", reverse: true },
      { text: "The price feels fair for what I get.", subscale: "Product fit", reverse: false },
      { text: "When I asked for help, I got a useful answer quickly.", subscale: "Support", reverse: false },
      { text: "I had to explain my problem more than once.", subscale: "Support", reverse: true },
      { text: "The documentation answered my question without contacting anyone.", subscale: "Support", reverse: false },
      { text: "I felt like a nuisance when I asked for help.", subscale: "Support", reverse: true },
      { text: "I would recommend this to someone with a similar need.", subscale: "Loyalty", reverse: false },
      { text: "I expect to still be using it in six months.", subscale: "Loyalty", reverse: false },
      { text: "I have looked at alternatives recently.", subscale: "Loyalty", reverse: true },
      { text: "I would be disappointed if this went away.", subscale: "Loyalty", reverse: false },
    ],
    bands: [
      { name: "At risk", range: "1.0 – 2.4", text: "This dimension is a churn risk. Read the free-text and lowest items before acting." },
      { name: "Neutral", range: "2.5 – 3.7", text: "Satisfied enough to stay, not enough to advocate. Usually the biggest improvement opportunity." },
      { name: "Strong", range: "3.8 – 5.0", text: "This dimension is a strength worth protecting and describing in your marketing." },
    ],
    scoringNotes: [
      "Keep product fit, support and loyalty separate — good support often hides a product-fit problem in a single average.",
      "Reverse-score the four negatively worded items before averaging.",
      "Send it after a real interaction rather than on a fixed calendar date.",
    ],
    prompt:
      "Build a 12-item post-purchase customer satisfaction questionnaire with three subscales (Product fit, Support, Loyalty), a 5-point agreement scale, reverse-scored negative items, mean scoring and at-risk/neutral/strong score-range wording.",
  },
  {
    slug: "team-culture-questionnaire",
    title: "Team culture questionnaire",
    audience: "Team leads and consultants",
    summary:
      "A 12-item culture questionnaire measuring psychological safety, clarity of ownership and feedback habits.",
    metaTitle: "Team culture questionnaire template (12 items, with scoring)",
    metaDescription:
      "A free 12-item team culture questionnaire template covering safety, ownership and feedback, with a 5-point scale, reverse-scored items and score-range wording.",
    scale: AGREE_5,
    method: "mean",
    subscales: ["Safety", "Ownership", "Feedback"],
    items: [
      { text: "I can raise a problem in this team without it being held against me.", subscale: "Safety", reverse: false },
      { text: "Mistakes here are treated as something to learn from.", subscale: "Safety", reverse: false },
      { text: "People stay quiet in meetings to avoid conflict.", subscale: "Safety", reverse: true },
      { text: "I can admit I do not know something.", subscale: "Safety", reverse: false },
      { text: "It is clear who decides what on this team.", subscale: "Ownership", reverse: false },
      { text: "Work often falls through the gaps between people.", subscale: "Ownership", reverse: true },
      { text: "I know what I am accountable for this quarter.", subscale: "Ownership", reverse: false },
      { text: "Decisions get revisited endlessly without resolution.", subscale: "Ownership", reverse: true },
      { text: "I get feedback often enough to correct course early.", subscale: "Feedback", reverse: false },
      { text: "Feedback here is specific rather than vague.", subscale: "Feedback", reverse: false },
      { text: "Praise and criticism are given only in formal reviews.", subscale: "Feedback", reverse: true },
      { text: "I feel comfortable giving feedback upwards.", subscale: "Feedback", reverse: false },
    ],
    bands: [
      { name: "Fragile", range: "1.0 – 2.4", text: "This dimension is a real constraint on the team. Address it before layering on new process." },
      { name: "Developing", range: "2.5 – 3.7", text: "Present but inconsistent. Look for which behaviours happen only sometimes." },
      { name: "Healthy", range: "3.8 – 5.0", text: "A working strength. Name the specific habits producing it so they survive team changes." },
    ],
    scoringNotes: [
      "Use it anonymously — psychological safety items are the first to be distorted when responses are identifiable.",
      "Reverse-score the four negatively worded items, then take the mean per subscale.",
      "Compare the same team over time rather than comparing different teams to each other.",
    ],
    prompt:
      "Build a 12-item team culture questionnaire with three subscales (Safety, Ownership, Feedback), a 5-point agreement scale, reverse-scored negative items, mean scoring and fragile/developing/healthy score-range wording, designed to be run anonymously.",
  },
];

export function templateBySlug(slug: string): QuestionnaireTemplate | undefined {
  return TEMPLATES.find((t) => t.slug === slug);
}
