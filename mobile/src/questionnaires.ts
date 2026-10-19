// Generated from prototype-demo.js. Regenerate with node scripts/import-prototype.cjs.
import type { Category } from './domain';
import { hairQuestionnaire } from './hairQuestionnaire';
import { contentCreatorQuestionnaire } from './contentCreatorQuestionnaire';
export type Question = { id: string; label: string; type: 'select' | 'multi' | 'text' | 'number' | 'textarea'; required?: boolean; privateField?: boolean; hint?: string; options?: string[]; min?: number; max?: number };
export type QuestionSection = { title: string; description: string; fields: Question[] };
export const questionnaires: Record<Category, QuestionSection[]> = {
  HairStylist: hairQuestionnaire,
  ContentCreator: contentCreatorQuestionnaire,
  "Photographer": [
    {
      "title": "Your photography practice",
      "description": "Tell clients what you shoot and how you work.",
      "fields": [
        {
          "id": "genres",
          "label": "What do you shoot?",
          "type": "multi",
          "options": [
            "Wedding",
            "Portrait",
            "Product",
            "Fashion",
            "Events",
            "Architecture",
            "Food",
            "Documentary"
          ],
          "required": true
        },
        {
          "id": "experience",
          "label": "Professional experience",
          "type": "select",
          "options": [
            "Under 1 year",
            "1–2 years",
            "3–5 years",
            "6–10 years",
            "10+ years"
          ],
          "required": true
        },
        {
          "id": "style",
          "label": "Your visual style",
          "type": "multi",
          "options": [
            "Candid",
            "Editorial",
            "Traditional",
            "Fine art",
            "Documentary",
            "Studio",
            "Lifestyle"
          ],
          "required": false
        },
        {
          "id": "clients",
          "label": "Projects you take",
          "type": "multi",
          "options": [
            "Individuals",
            "Weddings",
            "Brands",
            "Film productions",
            "Agencies",
            "Corporate"
          ],
          "required": false
        },
        {
          "id": "languages",
          "label": "Client communication languages",
          "type": "multi",
          "options": [
            "English",
            "Hindi",
            "Kannada",
            "Tamil",
            "Telugu",
            "Malayalam",
            "Other"
          ],
          "required": false
        },
        {
          "id": "team",
          "label": "Usual team size",
          "type": "select",
          "options": [
            "Solo",
            "Photographer + assistant",
            "2 photographers",
            "3–5 crew",
            "Custom crew"
          ],
          "required": false
        },
        {
          "id": "training",
          "label": "Training or certifications",
          "type": "text",
          "hint": "Optional: degree, courses or workshops",
          "required": false
        },
        {
          "id": "credits",
          "label": "Selected clients / project credits",
          "type": "textarea",
          "hint": "Only mention credits you can publicly share"
        }
      ]
    },
    {
      "title": "Cameras, lenses & lighting",
      "description": "Share your actual kit, not just “professional camera”.",
      "fields": [
        {
          "id": "camera-brands",
          "label": "Camera brands you use",
          "type": "multi",
          "options": [
            "Canon",
            "Sony",
            "Nikon",
            "Fujifilm",
            "Panasonic",
            "Leica",
            "Hasselblad",
            "Other"
          ],
          "required": true
        },
        {
          "id": "camera-models",
          "label": "Camera body models",
          "type": "text",
          "hint": "e.g. Sony A7 IV; Canon EOS R6 Mark II",
          "required": true
        },
        {
          "id": "sensor",
          "label": "Primary camera sensor",
          "type": "select",
          "options": [
            "Full-frame",
            "APS-C",
            "Micro Four Thirds",
            "Medium format",
            "Other"
          ],
          "required": false
        },
        {
          "id": "lenses",
          "label": "Lens models & focal lengths",
          "type": "text",
          "hint": "e.g. 24–70mm f/2.8, 50mm f/1.8",
          "required": false
        },
        {
          "id": "lighting",
          "label": "Lighting available",
          "type": "multi",
          "options": [
            "Speedlight",
            "Studio strobes",
            "Continuous LEDs",
            "Softboxes",
            "Reflectors",
            "Portable battery kit",
            "None"
          ],
          "required": false
        },
        {
          "id": "backup",
          "label": "Backup camera / memory setup",
          "type": "select",
          "options": [
            "Spare body + dual-card recording",
            "Spare body",
            "Dual-card recording",
            "Rental backup",
            "No backup currently"
          ],
          "required": false
        },
        {
          "id": "drone",
          "label": "Drone model, if offered",
          "type": "text",
          "hint": "Leave blank if you do not offer drone work",
          "required": false
        },
        {
          "id": "drone-clearance",
          "label": "Drone work readiness",
          "type": "select",
          "options": [
            "Not offered",
            "Pilot credentials & permissions arranged per job",
            "Working with a qualified drone partner"
          ],
          "required": false
        },
        {
          "id": "support-gear",
          "label": "Additional equipment",
          "type": "multi",
          "options": [
            "Tripod",
            "Gimbal",
            "Tethering setup",
            "Backdrop kit",
            "Audio recorder",
            "Underwater housing"
          ],
          "required": false
        },
        {
          "id": "kit-included",
          "label": "Equipment pricing",
          "type": "select",
          "options": [
            "Own basic kit included",
            "Equipment charged separately",
            "Depends on package"
          ],
          "required": false
        }
      ]
    },
    {
      "title": "Editing & delivery",
      "description": "Set clear expectations before someone books.",
      "fields": [
        {
          "id": "editing-software",
          "label": "Editing tools",
          "type": "multi",
          "options": [
            "Lightroom",
            "Photoshop",
            "Capture One",
            "Luminar",
            "Other"
          ],
          "required": false
        },
        {
          "id": "file-formats",
          "label": "Delivery formats",
          "type": "multi",
          "options": [
            "JPEG",
            "PNG",
            "TIFF",
            "Print-ready files",
            "RAW on agreement"
          ],
          "required": false
        },
        {
          "id": "photo-count",
          "label": "Typical edited images per shoot",
          "type": "number",
          "min": 1,
          "max": 10000,
          "hint": "e.g. 20",
          "privateField": false
        },
        {
          "id": "turnaround",
          "label": "Usual delivery time",
          "type": "select",
          "options": [
            "Same day",
            "24–48 hours",
            "3–5 days",
            "7 days",
            "14 days",
            "Project-specific"
          ],
          "required": true
        },
        {
          "id": "revisions",
          "label": "Included revision rounds",
          "type": "select",
          "options": [
            "None",
            "1 round",
            "2 rounds",
            "3 rounds",
            "By agreement"
          ],
          "required": false
        },
        {
          "id": "delivery-method",
          "label": "How do you deliver?",
          "type": "select",
          "options": [
            "Private online gallery",
            "Cloud download link",
            "Physical drive",
            "Client preference"
          ],
          "required": false
        },
        {
          "id": "raw-policy",
          "label": "RAW / original files policy",
          "type": "select",
          "options": [
            "Not included",
            "Available at extra cost",
            "Included by agreement"
          ],
          "required": false
        },
        {
          "id": "usage",
          "label": "Image usage rights",
          "type": "select",
          "options": [
            "Personal use",
            "Commercial usage quoted separately",
            "Client-specific license"
          ],
          "required": false
        },
        {
          "id": "retention",
          "label": "Gallery / backup retention",
          "type": "select",
          "options": [
            "30 days",
            "90 days",
            "6 months",
            "1 year",
            "By agreement"
          ],
          "required": false
        }
      ]
    },
    {
      "title": "Shoot logistics",
      "description": "Help us match you with suitable bookings.",
      "fields": [
        {
          "id": "locations",
          "label": "Where can you shoot?",
          "type": "multi",
          "options": [
            "Client location",
            "Own studio",
            "Rental studio",
            "Outdoor",
            "Travel assignments"
          ],
          "required": false
        },
        {
          "id": "studio",
          "label": "Studio access",
          "type": "select",
          "options": [
            "Own studio",
            "Partner studio",
            "Rental on request",
            "No studio"
          ],
          "required": false
        },
        {
          "id": "studio-equipment",
          "label": "Studio facilities",
          "type": "text",
          "hint": "Backdrop sizes, lighting and changing area",
          "required": false
        },
        {
          "id": "notice",
          "label": "Minimum booking notice",
          "type": "select",
          "options": [
            "Instant if available",
            "4 hours",
            "24 hours",
            "3 days",
            "1 week"
          ],
          "required": false
        },
        {
          "id": "overtime",
          "label": "Overtime policy",
          "type": "select",
          "options": [
            "Hourly extra",
            "Half-day extra",
            "By agreement",
            "Not offered"
          ],
          "required": false
        },
        {
          "id": "travel-kit",
          "label": "Transport for gear",
          "type": "select",
          "options": [
            "Own transport",
            "Client transport required",
            "Travel cost quoted separately"
          ],
          "required": false
        },
        {
          "id": "client-prep",
          "label": "What should a client prepare?",
          "type": "textarea",
          "hint": "Moodboard, shot list, wardrobe or permissions"
        },
        {
          "id": "shoot-boundaries",
          "label": "Booking limits / special requirements",
          "type": "textarea",
          "hint": "Projects you do not take, setup needs or accessibility preferences"
        }
      ]
    }
  ],
  "Makeup": [
    {
      "title": "Your makeup expertise",
      "description": "Define the looks and clients you work with.",
      "fields": [
        {
          "id": "services",
          "label": "Your services",
          "type": "multi",
          "options": [
            "Bridal",
            "Party",
            "Editorial",
            "Film / TV",
            "SFX",
            "Grooming",
            "Hair styling",
            "Draping"
          ],
          "required": true
        },
        {
          "id": "experience",
          "label": "Professional experience",
          "type": "select",
          "options": [
            "Under 1 year",
            "1–2 years",
            "3–5 years",
            "6–10 years",
            "10+ years"
          ],
          "required": true
        },
        {
          "id": "techniques",
          "label": "Techniques you offer",
          "type": "multi",
          "options": [
            "HD makeup",
            "Airbrush",
            "Natural finish",
            "Full glam",
            "Mature-skin makeup",
            "Stage makeup",
            "Prosthetics"
          ],
          "required": false
        },
        {
          "id": "events",
          "label": "Booking types",
          "type": "multi",
          "options": [
            "Weddings",
            "Pre-wedding",
            "Events",
            "Fashion shoots",
            "Film sets",
            "Lessons"
          ],
          "required": false
        },
        {
          "id": "training",
          "label": "Certifications / training",
          "type": "text",
          "hint": "Academy, mentor or course",
          "required": false
        },
        {
          "id": "languages",
          "label": "Languages",
          "type": "multi",
          "options": [
            "English",
            "Hindi",
            "Kannada",
            "Tamil",
            "Telugu",
            "Other"
          ],
          "required": false
        },
        {
          "id": "team",
          "label": "Team setup",
          "type": "select",
          "options": [
            "Solo",
            "With hairstylist",
            "With assistant",
            "Full bridal team"
          ],
          "required": false
        },
        {
          "id": "signature",
          "label": "Describe your signature style",
          "type": "textarea",
          "hint": ""
        }
      ]
    },
    {
      "title": "Your kit & hygiene",
      "description": "Products and preparation matter as much as the finished look.",
      "fields": [
        {
          "id": "kit-brands",
          "label": "Brands in your kit",
          "type": "multi",
          "options": [
            "MAC",
            "Huda Beauty",
            "NARS",
            "Charlotte Tilbury",
            "Kryolan",
            "Make Up For Ever",
            "Other"
          ],
          "required": true
        },
        {
          "id": "base-products",
          "label": "Foundation / base products",
          "type": "text",
          "hint": "Main ranges and shade availability",
          "required": false
        },
        {
          "id": "kit-tools",
          "label": "Tools you bring",
          "type": "multi",
          "options": [
            "Brush kit",
            "Airbrush machine",
            "Ring light",
            "Makeup chair",
            "Hair tools",
            "Portable mirror"
          ],
          "required": false
        },
        {
          "id": "hygiene",
          "label": "Hygiene practices",
          "type": "multi",
          "options": [
            "Sanitized tools",
            "Disposable applicators",
            "Fresh sponges",
            "No double dipping",
            "Kit cleaning between bookings"
          ],
          "required": false
        },
        {
          "id": "skin-prep",
          "label": "Skin preparation",
          "type": "select",
          "options": [
            "Included",
            "Client prepares",
            "Discuss before booking"
          ],
          "required": false
        },
        {
          "id": "sensitive-skin",
          "label": "Product sensitivity process",
          "type": "select",
          "options": [
            "Consultation before booking",
            "Patch test on request",
            "Client-supplied products accepted"
          ],
          "required": false
        },
        {
          "id": "cruelty-free",
          "label": "Cruelty-free kit option",
          "type": "select",
          "options": [
            "Available",
            "Partially available",
            "Not currently offered"
          ],
          "required": false
        },
        {
          "id": "special-products",
          "label": "Special products / requests",
          "type": "text",
          "hint": "Fragrance-free options or client-provided products",
          "required": false
        }
      ]
    },
    {
      "title": "Looks, trials & timing",
      "description": "Make your package inclusions unambiguous.",
      "fields": [
        {
          "id": "look-minutes",
          "label": "Minutes for one makeup look",
          "type": "number",
          "min": 15,
          "max": 360,
          "hint": "e.g. 90",
          "privateField": false
        },
        {
          "id": "people-per-day",
          "label": "Maximum clients per day",
          "type": "number",
          "min": 1,
          "max": 30,
          "hint": "",
          "privateField": false
        },
        {
          "id": "trial",
          "label": "Trial session policy",
          "type": "select",
          "options": [
            "Included",
            "Paid trial",
            "On request",
            "Not offered"
          ],
          "required": false
        },
        {
          "id": "inclusions",
          "label": "Package inclusions",
          "type": "multi",
          "options": [
            "Lashes",
            "Hair styling",
            "Draping",
            "Touch-up kit",
            "Accessories placement",
            "None"
          ],
          "required": false
        },
        {
          "id": "touch-ups",
          "label": "On-site touch-ups",
          "type": "select",
          "options": [
            "Included limited time",
            "Hourly extra",
            "Not offered"
          ],
          "required": false
        },
        {
          "id": "look-changes",
          "label": "Additional look changes",
          "type": "select",
          "options": [
            "Available at extra cost",
            "Included in package",
            "Not offered"
          ],
          "required": false
        },
        {
          "id": "assistant-fee",
          "label": "Assistant / hairstylist charges",
          "type": "text",
          "hint": "Explain when extra charges apply",
          "required": false
        },
        {
          "id": "prep",
          "label": "Client preparation checklist",
          "type": "textarea",
          "hint": "Skincare, clean hair, lighting or seating needs"
        }
      ]
    },
    {
      "title": "Your working setup",
      "description": "Capture travel, workspace and event requirements.",
      "fields": [
        {
          "id": "workplaces",
          "label": "Where do you work?",
          "type": "multi",
          "options": [
            "Client venue",
            "Own studio",
            "Hotel",
            "Film location",
            "Salon"
          ],
          "required": false
        },
        {
          "id": "travel",
          "label": "Travel bookings",
          "type": "select",
          "options": [
            "Local only",
            "Outstation available",
            "Destination events available"
          ],
          "required": false
        },
        {
          "id": "early-start",
          "label": "Early-morning bookings",
          "type": "select",
          "options": [
            "Available",
            "Extra charge",
            "Not available"
          ],
          "required": false
        },
        {
          "id": "lead-time",
          "label": "Minimum notice",
          "type": "select",
          "options": [
            "Instant if available",
            "24 hours",
            "3 days",
            "1 week"
          ],
          "required": false
        },
        {
          "id": "space",
          "label": "Workspace requirements",
          "type": "select",
          "options": [
            "Bring full setup",
            "Well-lit table & power required",
            "Discuss per venue"
          ],
          "required": false
        },
        {
          "id": "consultation",
          "label": "Pre-booking consultation",
          "type": "select",
          "options": [
            "Video call",
            "In-app chat",
            "In-person paid consultation"
          ],
          "required": false
        },
        {
          "id": "portfolio-credits",
          "label": "Relevant event / production credits",
          "type": "textarea",
          "hint": ""
        },
        {
          "id": "limitations",
          "label": "Service boundaries & special requirements",
          "type": "textarea",
          "hint": ""
        }
      ]
    }
  ],
  "Actor": [
    {
      "title": "Your performance profile",
      "description": "Actors and models can tailor their casting profile.",
      "fields": [
        {
          "id": "performer-type",
          "label": "Your primary focus",
          "type": "select",
          "options": [
            "Actor",
            "Model",
            "Actor & model",
            "Voice artist",
            "Stage performer"
          ],
          "required": true
        },
        {
          "id": "work-types",
          "label": "Types of work",
          "type": "multi",
          "options": [
            "Film",
            "TV / web series",
            "Commercials",
            "Theatre",
            "Fashion",
            "Runway",
            "E-commerce",
            "Voiceover"
          ],
          "required": true
        },
        {
          "id": "experience",
          "label": "Professional experience",
          "type": "select",
          "options": [
            "New talent",
            "1–2 years",
            "3–5 years",
            "6–10 years",
            "10+ years"
          ],
          "required": false
        },
        {
          "id": "languages",
          "label": "Performance languages",
          "type": "multi",
          "options": [
            "English",
            "Hindi",
            "Kannada",
            "Tamil",
            "Telugu",
            "Malayalam",
            "Other"
          ],
          "required": false
        },
        {
          "id": "dialects",
          "label": "Accents / dialects",
          "type": "text",
          "hint": "Only those you can perform confidently",
          "required": false
        },
        {
          "id": "playing-age",
          "label": "Adult playing age",
          "type": "select",
          "options": [
            "18–25",
            "25–35",
            "35–45",
            "45–60",
            "60+"
          ],
          "required": false
        },
        {
          "id": "training",
          "label": "Acting / modelling training",
          "type": "text",
          "hint": "",
          "required": false
        },
        {
          "id": "credits",
          "label": "Selected credits / productions",
          "type": "textarea",
          "hint": ""
        }
      ]
    },
    {
      "title": "Casting & wardrobe details",
      "description": "Optional fitting details for relevant jobs. These are private, not public search filters.",
      "fields": [
        {
          "id": "gender",
          "label": "Gender / casting identity (optional)",
          "type": "select",
          "options": [
            "Woman",
            "Man",
            "Non-binary",
            "Self-describe in notes",
            "Prefer not to say"
          ],
          "required": false
        },
        {
          "id": "height",
          "label": "Height (cm)",
          "type": "number",
          "min": 100,
          "max": 250,
          "hint": "Optional",
          "privateField": true
        },
        {
          "id": "chest",
          "label": "Bust / chest (cm)",
          "type": "number",
          "min": 40,
          "max": 200,
          "hint": "Optional — all genders",
          "privateField": true
        },
        {
          "id": "waist",
          "label": "Waist (cm)",
          "type": "number",
          "min": 35,
          "max": 200,
          "hint": "Optional",
          "privateField": true
        },
        {
          "id": "hips",
          "label": "Hip (cm)",
          "type": "number",
          "min": 40,
          "max": 220,
          "hint": "Optional",
          "privateField": true
        },
        {
          "id": "clothing-size",
          "label": "Usual clothing size",
          "type": "text",
          "hint": "e.g. S / M / L, or your preferred sizing system",
          "required": false
        },
        {
          "id": "shoe-size",
          "label": "Shoe size & sizing system",
          "type": "text",
          "hint": "e.g. UK 6 / EU 39",
          "required": false
        },
        {
          "id": "hair",
          "label": "Hair length / current look",
          "type": "text",
          "hint": "Optional, for continuity and styling",
          "required": false
        },
        {
          "id": "fitting-notes",
          "label": "Wardrobe / fitting notes",
          "type": "textarea",
          "hint": "Any details you choose to share for a booked job"
        },
        {
          "id": "share-fitting",
          "label": "Sharing preference",
          "type": "select",
          "options": [
            "Keep private",
            "Share selected details after confirming a relevant job"
          ],
          "required": false
        }
      ]
    },
    {
      "title": "Skills & audition readiness",
      "description": "Show the abilities that matter for casting.",
      "fields": [
        {
          "id": "skills",
          "label": "Performance skills",
          "type": "multi",
          "options": [
            "Dance",
            "Singing",
            "Action / stage combat",
            "Comedy",
            "Improvisation",
            "Presenting",
            "Instruments",
            "None"
          ],
          "required": false
        },
        {
          "id": "modelling",
          "label": "Modelling experience",
          "type": "multi",
          "options": [
            "Runway",
            "Editorial",
            "E-commerce",
            "Beauty",
            "Fitness",
            "Not applicable"
          ],
          "required": false
        },
        {
          "id": "self-tape",
          "label": "Self-tape availability",
          "type": "select",
          "options": [
            "Same day",
            "Within 48 hours",
            "Within a week",
            "By agreement"
          ],
          "required": false
        },
        {
          "id": "audition-material",
          "label": "Materials available",
          "type": "multi",
          "options": [
            "Showreel",
            "Headshots",
            "Full-length photos",
            "Voice demo",
            "Self-tape setup"
          ],
          "required": false
        },
        {
          "id": "voice-studio",
          "label": "Voice recording setup",
          "type": "select",
          "options": [
            "Own treated studio",
            "Home recording setup",
            "External studio",
            "Not applicable"
          ],
          "required": false
        },
        {
          "id": "special-skills",
          "label": "Specific skills / proficiency",
          "type": "text",
          "hint": "e.g. piano intermediate, swimming competent",
          "required": false
        },
        {
          "id": "agency",
          "label": "Representation / agency",
          "type": "text",
          "hint": "Optional; no private contact details",
          "required": false
        },
        {
          "id": "reel-notes",
          "label": "What should a casting team know?",
          "type": "textarea",
          "hint": ""
        }
      ]
    },
    {
      "title": "Booking preferences & consent",
      "description": "Your boundaries are respected; no sensitive details are required.",
      "fields": [
        {
          "id": "schedule",
          "label": "Typical availability",
          "type": "select",
          "options": [
            "Weekdays",
            "Weekends",
            "Flexible",
            "Project-dependent"
          ],
          "required": false
        },
        {
          "id": "travel",
          "label": "Travel availability",
          "type": "select",
          "options": [
            "Local only",
            "Domestic travel",
            "International by agreement"
          ],
          "required": false
        },
        {
          "id": "shoot-day",
          "label": "Standard shoot day",
          "type": "select",
          "options": [
            "4 hours",
            "8 hours",
            "10 hours",
            "12 hours",
            "By agreement"
          ],
          "required": false
        },
        {
          "id": "usage",
          "label": "Commercial usage policy",
          "type": "select",
          "options": [
            "Quoted per campaign",
            "Limited-term license",
            "Discuss before booking"
          ],
          "required": false
        },
        {
          "id": "exclusivity",
          "label": "Exclusivity terms",
          "type": "select",
          "options": [
            "Non-exclusive",
            "Campaign-specific",
            "Agency approval required"
          ],
          "required": false
        },
        {
          "id": "audition-format",
          "label": "Preferred audition format",
          "type": "select",
          "options": [
            "Self-tape",
            "Online",
            "In person",
            "Any"
          ],
          "required": false
        },
        {
          "id": "boundaries",
          "label": "Role / wardrobe / performance boundaries",
          "type": "textarea",
          "hint": "Optional. Share only what helps establish your professional consent."
        },
        {
          "id": "access-needs",
          "label": "On-set requirements",
          "type": "textarea",
          "hint": "Optional practical requirements; do not include medical details"
        }
      ]
    }
  ],
  "Editor": [
    {
      "title": "Your editing expertise",
      "description": "Match with the right format, not just “an editor”.",
      "fields": [
        {
          "id": "specialisms",
          "label": "Core expertise",
          "type": "multi",
          "options": [
            "Video editing",
            "Color grading",
            "Motion graphics",
            "Photo retouching",
            "VFX",
            "Sound cleanup",
            "Subtitling"
          ],
          "required": true
        },
        {
          "id": "formats",
          "label": "Content formats",
          "type": "multi",
          "options": [
            "Reels / shorts",
            "YouTube",
            "Wedding films",
            "Ads",
            "Documentary",
            "Film / series",
            "Corporate"
          ],
          "required": false
        },
        {
          "id": "experience",
          "label": "Professional experience",
          "type": "select",
          "options": [
            "Under 1 year",
            "1–2 years",
            "3–5 years",
            "6–10 years",
            "10+ years"
          ],
          "required": true
        },
        {
          "id": "languages",
          "label": "Editing / subtitle languages",
          "type": "multi",
          "options": [
            "English",
            "Hindi",
            "Kannada",
            "Tamil",
            "Telugu",
            "Other"
          ],
          "required": false
        },
        {
          "id": "training",
          "label": "Training / certifications",
          "type": "text",
          "hint": "",
          "required": false
        },
        {
          "id": "credits",
          "label": "Selected credits",
          "type": "textarea",
          "hint": ""
        },
        {
          "id": "collaboration",
          "label": "Working mode",
          "type": "select",
          "options": [
            "Remote",
            "On-site",
            "Hybrid"
          ],
          "required": false
        },
        {
          "id": "team",
          "label": "Team setup",
          "type": "select",
          "options": [
            "Solo",
            "With motion designer",
            "With colorist",
            "Full post-production team"
          ],
          "required": false
        }
      ]
    },
    {
      "title": "Software & workstation",
      "description": "Specify your tools and supported workflows.",
      "fields": [
        {
          "id": "software",
          "label": "Editing software",
          "type": "multi",
          "options": [
            "Premiere Pro",
            "DaVinci Resolve",
            "Final Cut Pro",
            "Avid",
            "After Effects",
            "Photoshop",
            "Blender"
          ],
          "required": true
        },
        {
          "id": "software-version",
          "label": "Software versions / plugins",
          "type": "text",
          "hint": "e.g. Resolve Studio; your usual plugins",
          "required": false
        },
        {
          "id": "platform",
          "label": "Workstation platform",
          "type": "select",
          "options": [
            "Windows",
            "macOS",
            "Linux",
            "Multiple"
          ],
          "required": false
        },
        {
          "id": "workstation",
          "label": "CPU / GPU / RAM",
          "type": "text",
          "hint": "e.g. Apple M3 Pro, 36GB RAM",
          "required": false
        },
        {
          "id": "max-resolution",
          "label": "Comfortable source resolution",
          "type": "select",
          "options": [
            "1080p",
            "4K",
            "6K",
            "8K",
            "Depends on footage"
          ],
          "required": false
        },
        {
          "id": "codecs",
          "label": "Supported workflows",
          "type": "multi",
          "options": [
            "H.264 / H.265",
            "ProRes",
            "BRAW",
            "R3D",
            "Image sequences",
            "Proxy workflow"
          ],
          "required": false
        },
        {
          "id": "monitor",
          "label": "Color monitoring",
          "type": "select",
          "options": [
            "Calibrated reference monitor",
            "Calibrated computer display",
            "Standard display"
          ],
          "required": false
        },
        {
          "id": "storage",
          "label": "Storage / backup workflow",
          "type": "text",
          "hint": "No device identifiers or private account links",
          "required": false
        }
      ]
    },
    {
      "title": "Deliverables & revisions",
      "description": "Define exactly what your client receives.",
      "fields": [
        {
          "id": "exports",
          "label": "Export formats",
          "type": "multi",
          "options": [
            "MP4",
            "MOV / ProRes",
            "Image sequence",
            "GIF",
            "WAV",
            "SRT"
          ],
          "required": false
        },
        {
          "id": "ratios",
          "label": "Aspect ratios",
          "type": "multi",
          "options": [
            "9:16",
            "16:9",
            "1:1",
            "4:5",
            "Custom"
          ],
          "required": false
        },
        {
          "id": "project-files",
          "label": "Project files policy",
          "type": "select",
          "options": [
            "Included",
            "Extra cost",
            "Not included",
            "By agreement"
          ],
          "required": false
        },
        {
          "id": "revision-rounds",
          "label": "Included revisions",
          "type": "select",
          "options": [
            "1 round",
            "2 rounds",
            "3 rounds",
            "By agreement"
          ],
          "required": false
        },
        {
          "id": "turnaround",
          "label": "Typical turnaround",
          "type": "select",
          "options": [
            "24 hours",
            "48 hours",
            "3–5 days",
            "1 week",
            "Project-specific"
          ],
          "required": true
        },
        {
          "id": "captions",
          "label": "Captions / subtitles",
          "type": "select",
          "options": [
            "Included",
            "Add-on",
            "Not offered"
          ],
          "required": false
        },
        {
          "id": "licensed-assets",
          "label": "Music / stock assets",
          "type": "select",
          "options": [
            "Client provides licensed assets",
            "Licensed assets quoted separately",
            "Included limited library"
          ],
          "required": false
        },
        {
          "id": "retention",
          "label": "Project retention",
          "type": "select",
          "options": [
            "30 days",
            "90 days",
            "6 months",
            "By agreement"
          ],
          "required": false
        }
      ]
    },
    {
      "title": "Project handoff",
      "description": "Avoid preventable friction in every edit.",
      "fields": [
        {
          "id": "upload",
          "label": "Footage handoff",
          "type": "select",
          "options": [
            "Cloud link",
            "Physical drive",
            "Both"
          ],
          "required": false
        },
        {
          "id": "feedback",
          "label": "Feedback workflow",
          "type": "select",
          "options": [
            "Timecoded comments",
            "In-app brief",
            "Review platform",
            "Client preference"
          ],
          "required": false
        },
        {
          "id": "rush",
          "label": "Rush projects",
          "type": "select",
          "options": [
            "Available at extra charge",
            "If schedule allows",
            "Not available"
          ],
          "required": false
        },
        {
          "id": "source-limit",
          "label": "Package footage limit",
          "type": "select",
          "options": [
            "Up to 30 minutes",
            "Up to 2 hours",
            "Up to 8 hours",
            "Quoted individually"
          ],
          "required": false
        },
        {
          "id": "duration-limit",
          "label": "Typical output length",
          "type": "select",
          "options": [
            "Under 60 seconds",
            "1–5 minutes",
            "5–30 minutes",
            "Long-form"
          ],
          "required": false
        },
        {
          "id": "brief",
          "label": "What does your client need to provide?",
          "type": "textarea",
          "hint": "Brief, references, music rights, footage and brand assets"
        },
        {
          "id": "scope",
          "label": "What is outside your base package?",
          "type": "textarea",
          "hint": ""
        },
        {
          "id": "security",
          "label": "Confidentiality / file-handling preferences",
          "type": "textarea",
          "hint": ""
        }
      ]
    }
  ],
  "Dancer": [
    {
      "title": "Your dance practice",
      "description": "Tell us your styles, roles and experience.",
      "fields": [
        {
          "id": "styles",
          "label": "Dance styles",
          "type": "multi",
          "options": [
            "Bollywood",
            "Contemporary",
            "Hip-hop",
            "Bharatanatyam",
            "Kathak",
            "Salsa",
            "Jazz",
            "Other"
          ],
          "required": true
        },
        {
          "id": "services",
          "label": "Services",
          "type": "multi",
          "options": [
            "Live performance",
            "Choreography",
            "Wedding choreography",
            "Teaching",
            "Music videos",
            "Film shoots"
          ],
          "required": true
        },
        {
          "id": "experience",
          "label": "Professional experience",
          "type": "select",
          "options": [
            "Under 1 year",
            "1–2 years",
            "3–5 years",
            "6–10 years",
            "10+ years"
          ],
          "required": false
        },
        {
          "id": "setup",
          "label": "Performance setup",
          "type": "select",
          "options": [
            "Solo",
            "Duo",
            "Crew",
            "Flexible"
          ],
          "required": false
        },
        {
          "id": "crew-count",
          "label": "Available crew size",
          "type": "number",
          "min": 1,
          "max": 100,
          "hint": "",
          "privateField": false
        },
        {
          "id": "training",
          "label": "Training / certifications",
          "type": "text",
          "hint": "",
          "required": false
        },
        {
          "id": "languages",
          "label": "Teaching / coordination languages",
          "type": "multi",
          "options": [
            "English",
            "Hindi",
            "Kannada",
            "Tamil",
            "Telugu",
            "Other"
          ],
          "required": false
        },
        {
          "id": "credits",
          "label": "Selected stages / production credits",
          "type": "textarea",
          "hint": ""
        }
      ]
    },
    {
      "title": "Performance & choreography",
      "description": "Describe the scope of your act.",
      "fields": [
        {
          "id": "set-duration",
          "label": "Typical performance duration (minutes)",
          "type": "number",
          "min": 1,
          "max": 180,
          "hint": "",
          "privateField": false
        },
        {
          "id": "rehearsals",
          "label": "Rehearsals usually required",
          "type": "number",
          "min": 0,
          "max": 60,
          "hint": "",
          "privateField": false
        },
        {
          "id": "custom-routine",
          "label": "Custom choreography",
          "type": "select",
          "options": [
            "Available",
            "Limited customization",
            "Existing acts only"
          ],
          "required": false
        },
        {
          "id": "events",
          "label": "Event types",
          "type": "multi",
          "options": [
            "Weddings",
            "Stage shows",
            "Corporate",
            "Festivals",
            "Film / music video",
            "Private lessons"
          ],
          "required": false
        },
        {
          "id": "teaching-mode",
          "label": "Teaching format",
          "type": "select",
          "options": [
            "In person",
            "Online",
            "Both",
            "Not offered"
          ],
          "required": false
        },
        {
          "id": "teaching-level",
          "label": "Teaching level",
          "type": "select",
          "options": [
            "Beginners",
            "Intermediate",
            "Advanced",
            "All levels",
            "Not offered"
          ],
          "required": false
        },
        {
          "id": "costumes",
          "label": "Costume support",
          "type": "select",
          "options": [
            "Included",
            "Extra charge",
            "Client provides",
            "Discuss per routine"
          ],
          "required": false
        },
        {
          "id": "music-edit",
          "label": "Music editing",
          "type": "select",
          "options": [
            "Included",
            "Extra charge",
            "Client provides track"
          ],
          "required": false
        }
      ]
    },
    {
      "title": "Stage & equipment",
      "description": "Capture the practical needs of your performance.",
      "fields": [
        {
          "id": "stage-size",
          "label": "Minimum performance space",
          "type": "text",
          "hint": "e.g. 4m × 4m",
          "required": false
        },
        {
          "id": "flooring",
          "label": "Suitable floor types",
          "type": "multi",
          "options": [
            "Wood",
            "Marley",
            "Carpet",
            "Smooth indoor floor",
            "Outdoor stage"
          ],
          "required": false
        },
        {
          "id": "tech-needs",
          "label": "Technical requirements",
          "type": "multi",
          "options": [
            "Sound system",
            "Stage lights",
            "Wireless mic",
            "Playback operator",
            "None"
          ],
          "required": false
        },
        {
          "id": "props",
          "label": "Props support",
          "type": "select",
          "options": [
            "Bring own props",
            "Client arranges",
            "Not needed"
          ],
          "required": false
        },
        {
          "id": "changing-area",
          "label": "Changing / preparation area",
          "type": "select",
          "options": [
            "Required",
            "Preferred",
            "Not needed"
          ],
          "required": false
        },
        {
          "id": "setup-time",
          "label": "Setup time (minutes)",
          "type": "number",
          "min": 0,
          "max": 180,
          "hint": "",
          "privateField": false
        },
        {
          "id": "outdoor",
          "label": "Outdoor performances",
          "type": "select",
          "options": [
            "Available",
            "Weather dependent",
            "Indoor only"
          ],
          "required": false
        },
        {
          "id": "stage-notes",
          "label": "Stage safety / setup notes",
          "type": "textarea",
          "hint": "Floor condition, clear space and equipment requirements"
        }
      ]
    },
    {
      "title": "Rehearsals & bookings",
      "description": "Set expectations for timing and coordination.",
      "fields": [
        {
          "id": "notice",
          "label": "Booking lead time",
          "type": "select",
          "options": [
            "Instant existing act",
            "24 hours",
            "3 days",
            "1 week",
            "2+ weeks"
          ],
          "required": false
        },
        {
          "id": "travel",
          "label": "Travel availability",
          "type": "select",
          "options": [
            "Local only",
            "Domestic",
            "Destination events by agreement"
          ],
          "required": false
        },
        {
          "id": "rehearsal-place",
          "label": "Rehearsal location",
          "type": "select",
          "options": [
            "Own studio",
            "Client space",
            "Rental studio",
            "Online"
          ],
          "required": false
        },
        {
          "id": "extra-rehearsal",
          "label": "Extra rehearsal policy",
          "type": "select",
          "options": [
            "Hourly extra",
            "Session extra",
            "By agreement"
          ],
          "required": false
        },
        {
          "id": "recording",
          "label": "Performance recording",
          "type": "select",
          "options": [
            "Personal recording allowed",
            "Commercial rights negotiated",
            "Ask before recording"
          ],
          "required": false
        },
        {
          "id": "cancellation",
          "label": "Rescheduling preference",
          "type": "select",
          "options": [
            "24-hour notice",
            "48-hour notice",
            "Project-specific"
          ],
          "required": false
        },
        {
          "id": "client-prep",
          "label": "Client preparation checklist",
          "type": "textarea",
          "hint": ""
        },
        {
          "id": "boundaries",
          "label": "Performance boundaries / special requirements",
          "type": "textarea",
          "hint": ""
        }
      ]
    }
  ]
};
