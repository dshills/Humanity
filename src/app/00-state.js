// HT.app, part 00: Constants and state shared by every part.
// One of the files that build.mjs joins, in name order, inside a single closure (see src/app/README.md):
// everything here shares scope with the other parts, so nothing is exported or imported.

  const HT = root.HT || (root.HT = {});
  const C = HT.core;                      // pure rules, tested in test/core.test.js

  // ------------------------------------------------------------------
  // 1. Constants and state
  // ------------------------------------------------------------------
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const ZOOM_FACTOR = 4;
  const ANIM_MS = 250;
  const MIN_SPAN = C.MIN_SPAN;            // one day in years (>= one calendar day in common and leap years)
  const MIN_VISIBLE = 8;                  // admit lower tiers until this many events are in view
  const THEMES = ['ops', 'crt', 'nvg', 'ironbow', 'noir', 'paper'];
  const THEME_KEY = 'ht-theme';
  const EARTH_KEY = 'ht-earth';
  const HIDDEN_KEY = 'ht-hidden-cats';
  const REIGNS_KEY = 'ht-reigns';
  const LIVES_KEY = 'ht-lives';
  const BIRTH_KEY = 'ht-birth';
  const LIVES_MAX_SPAN = 3000;            // wider than this a lifetime is a few pixels
  const IMAGES_KEY = 'ht-images';
  const REGION_KEY = 'ht-region';
  const HELP_KEY = 'ht-help-seen';
  const MM_BINS = 160;
  const REIGN_MAX_SPAN = 20000;       // wider than this, five millennia of reigns are a smear at the edge
  const CITY_MAX_SPAN = 40000;
  const RECORDED_START = -3299;       // c. 3300 BCE, the first writing: where "recorded history" begins
  const ERA_TOP = 30;                 // y of the recorded-history bracket
  const ERA_RESERVE = 52;             // px kept clear of lanes beneath the top of the stage while it shows
  const IMAGE_CACHE_KEY = 'ht-summary-cache';      // was ht-image-cache before summaries were kept too
  const OTD_MAX_SPAN = C.OTD_MAX_SPAN;    // about a month: the widest view that loads Wikipedia's "on this day" lists
  const OTD_CACHE_KEY = 'ht-otd-cache';
  const OTD_CACHE_DAYS = 40;              // days kept in localStorage, oldest dropped first
  const OTD_HINT_KEY = 'ht-otd-hint';
  const SCALE_KEY = 'ht-scale';
  const OTD_PARALLEL = 6;
  const OTD_ENDPOINT = 'https://en.wikipedia.org/api/rest_v1/feed/onthisday/events/';
  const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const IMAGE_CACHE_MAX = 200;
  const API_UA = 'HumanityTimeline/1.0 (https://github.com/dshills/Humanity)';
  const REIGN_ROW_H = 17;                 // px per swimlane row
  const REIGN_TOP = 22;                   // px from the top of the stage to the first row (clears the corner bracket)
  const REIGN_MAX_ROWS = 12;
  const REIGN_MIN_WIDTH = 640;            // narrower stages keep reigns as ordinary events
  const WIKI_PREFIX = C.WIKI_PREFIX;
  const SEARCH_LIMIT = 12;
  const EARTH_ORDER = ['co2', 'temp', 'sea', 'pop'];
  const POP_META = { label: 'Population', range: [6.5, 10], log: true };   // log10 scale: 3 million to 10 billion
  const CITY_H = 15;
  const DRAG_THRESHOLD = 4;               // px of movement before a press becomes a drag
  const RESIZE_DEBOUNCE_MS = 100;
  const URL_DEBOUNCE_MS = 200;            // trailing replaceState during wheel/drag (Safari rate-limits history writes)
  const AXIS_FRACTION = 0.62;             // the axis sits at 62% of the stage height
  const LANE_PITCH = 26;                  // px between label lanes
  const MAX_LANES = 8;
  const LANE_TOP_PAD = 24;                // px kept free above the top-most lane
  const LANE_BASE_OFFSET = 18;            // px from the axis up to lane 0's text baseline
  const MARKER_R = 5;                     // point marker radius
  const BAR_H = 6;                        // range bar height
  const LABEL_GAP = 6;                    // px between a marker and its label
  const EDGE_PAD = 4;                     // px keep-out at the left/right edges
  const ROOT_CRUMB = 'All of humanity';
  const WHEEL_K = 0.002;                  // zoom factor = exp(deltaY * K) for mouse wheels
  const PINCH_K = 0.01;                   // trackpad pinch (ctrlKey wheel) reports much smaller deltas
  const TIER_SPANS_FALLBACK = [100000, 20000, 5000, 1000, 200, 50, 10, 10];

  let inited = false;
  let dom = null;                         // element references (filled by init)
  let NOW = null;                         // t of the current instant, fixed at init
  let view = null;                        // committed logical view {start, end}
  let shown = null;                       // the view currently drawn (differs from `view` only mid-animation)
  let stack = [];                         // zoom history: [{start, end, discrete}] root … current
  let anim = null;                        // running animation {raf}
  const size = { width: 1, height: 1 };   // stage pixel size
  let selected = -1;                      // index of the event open in the panel
  const widthCache = new Map();           // 'kind\0text' -> measured px
  let measureTickEl = null;               // hidden <text class="tick-label">
  let measureLabelEl = null;              // hidden <text class="label">
  let resizeTimer = 0;
  let urlTimer = 0;
  let urlPending = false;
  const pointers = new Map();             // active pointers: id -> {x, y}
  let gesture = null;                     // {type:'press'|'pinch', ...}
  let lastMouseX = null;                  // last mouse clientX over the stage (null when no mouse is over it)
  let theme = 'auto';                     // 'auto' resolves to ops/paper from prefers-color-scheme
  let settleNext = false;                 // next render follows a discrete view change: animate arrivals
  let lastAxisY = 0;
  let chipHalf = 40;                      // cached half-width of the cursor chip
  let hudStats = { visible: 0, inWindow: 0, tier: 0 };
  let clockTimer = 0;
  let earthOn = true;                     // climate sparklines visible
  const hiddenCats = new Set();           // categories filtered out via the legend
  let reignsOn = true;                    // ruler swimlanes visible
  let birthYear = null;                   // "Your lifetime": kept in this browser only, never written to the URL
  let lifeTourDef = null;                 // the tour generated from it
  let livesOn = false;                    // lifespans of notable people instead (the two layers share the top of the stage)
  let livesRows = [];                     // [[event index]] per row, chosen for this frame
  let livesStats = { shown: 0, inView: 0 };
  let imagesOn = false;                   // opt-in: fetch a thumbnail from Wikimedia for the open event
  let regionFilter = null;                // null = everywhere, else a key of REGIONS
  let regionCache = null;                 // event index -> region key | '' (unknown)
  let slugIndex = null;                   // { bySlug: Map, byIndex: [] } for ev= permalinks
  let pendingEv = -1;                     // event index named by the URL, opened once the view is set
  let mmDensity = null;                   // minimap density bins
  let mmDrag = false;
  let mmGrab = 0;
  let mmDownX = 0;
  let mmMoved = false;
  let imageSeq = 0;                     // guards against a slow response landing on a different event
  const otdDays = new Map();              // 'MM/DD' -> 'loading' | 'done' | 'error'
  const otdInflight = new Map();          // 'MM/DD' -> the promise of a request under way
  let otdQueue = [];
  let otdActive = 0;
  let otdTimer = 0;
  let otdRenderTimer = 0;
  let otdInView = 0;                      // on-this-day events inside the current view
  let otdHint = true;                     // offer the layer on deep views while the opt-in is off
  let otdLinkIndex = null;                // article title -> [t] of bundled events, to skip what is already here
  let scaleMode = 'log';                  // 'log': the widest views use a warped axis (HT.core.tToU); 'lin': never
  let measureFrom = -1;                   // index of the event being measured from, or -1
  let embed = false;                      // ?embed=1: a quiet page for an iframe (no chrome, no history entries)
  let tour = null;                        // { def, step } while a guided tour is running
  let pendingTour = null;                 // { id, step } last parsed from the URL
  let titleIndex = null;                  // event title -> index, for tour steps
  let pendingSlug = '';                   // ev= slug that named nothing yet (an on-this-day event not loaded)
  let imageCache = null;                  // { title: { src, page, credit } | 0 }  (0 = nothing usable)
  let reignReserve = 0;                   // px at the top of the stage reserved for swimlanes this frame
  let reignRows = [];                     // [{ group, items: [event index] }] chosen for this frame
  let groupOrder = null;                  // stable row order: first appearance in the data
  let searchIndex = null;                 // lazily built [{ i, key }] of lower-cased titles
  let searchHits = [];
  let searchActive = -1;
  let suppressClickUntil = 0;
