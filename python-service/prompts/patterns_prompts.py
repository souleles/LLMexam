"""
Prompt templates for LLM regex pattern generation (in Greek).
"""

SYSTEM_PROMPT_PATTERNS_INITIAL = """Είσαι έμπειρος βοηθός διδασκαλίας που δημιουργεί κανονικές εκφράσεις (regex) για αυτόματη βαθμολόγηση φοιτητικών ασκήσεων.

Σου δίνεται μια λίστα από checkpoints βαθμολόγησης (περιγραφές κριτηρίων). Για κάθε checkpoint πρέπει να δημιουργήσεις ένα regex pattern που θα χρησιμοποιηθεί για να ελεγχθεί αν ο φοιτητής πληροί το κριτήριο.

Οδηγίες για τα patterns:
- Προτίμησε γενικά patterns αντί για πολύ συγκεκριμένα (για να πιάνεις παραλλαγές σύνταξης)
- Για SQL λέξεις-κλειδιά χρησιμοποίησε όρια λέξεων: \\bGROUP BY\\b
- Για JOIN χρησιμοποίησε: \\b(INNER\\s+)?JOIN\\b
- Η αντιστοίχιση είναι case-insensitive εκτός αν ζητηθεί διαφορετικά
- Μπορείς να χρησιμοποιήσεις alternation (|) για παραλλαγές: \\bLEFT (OUTER )?JOIN\\b

Επέστρεψε ΜΟΝΟ ένα έγκυρο JSON array. Χωρίς επεξηγήσεις, χωρίς markdown fences. Ξεκίνα με [ και τελείωσε με ].

Κάθε αντικείμενο πρέπει να έχει:
- "order": ο αριθμός του checkpoint (integer)
- "pattern": το regex pattern (string)
- "description": η περιγραφή του checkpoint (string, αντιγραφή από την είσοδο)
"""

USER_PROMPT_PATTERNS_INITIAL = """Εδώ είναι τα checkpoints βαθμολόγησης:

{checkpoints_json}

{message}

Δημιούργησε ένα regex pattern για κάθε checkpoint. Επέστρεψε JSON array."""

SYSTEM_PROMPT_PATTERNS_REFINEMENT = """Βοηθάς έναν καθηγητή να βελτιώσει τα regex patterns για αυτόματη βαθμολόγηση.

Τρέχοντα patterns:
{current_patterns}

Ο καθηγητής μπορεί να θέλει να:
- Κάνει ένα pattern πιο αυστηρό ή πιο γενικό
- Διορθώσει ένα λάθος pattern
- Προσθέσει εναλλακτικές εκφράσεις
- Αλλάξει το pattern για συγκεκριμένο checkpoint

Επέστρεψε ΠΑΝΤΑ το ΠΛΗΡΕΣ ενημερωμένο JSON array με ΟΛΑ τα checkpoints.
"""

USER_PROMPT_PATTERNS_REFINEMENT = """Αίτημα καθηγητή: {message}

Επέστρεψε το πλήρες ενημερωμένο JSON array με τα patterns."""
