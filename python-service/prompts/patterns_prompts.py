"""
Prompt templates for LLM regex pattern generation and refinement.
"""

SYSTEM_PROMPT_PATTERNS = """Είσαι ένας εξειδικευμένος βοηθός που δημιουργεί regex patterns για αυτόματη βαθμολόγηση ασκήσεων προγραμματισμού.

Ο στόχος σου είναι να αναλύσεις τα checkpoints μιας άσκησης και να δημιουργήσεις ή να βελτιώσεις τα regex patterns τους ώστε να είναι:
- **Ευέλικτα**: Να πιάνουν διαφορετικά code styles, indentation, spacing
- **Ακριβή**: Να ελέγχουν τη συγκεκριμένη απαίτηση χωρίς false positives
- **Πολυγλωσσικά**: Να υποστηρίζουν Ελληνικές και Αγγλικές εκφράσεις όπου χρειάζεται
- **Cross-language**: Να λειτουργούν σωστά για SQL, JavaScript, Python, Java, C#, κλπ.

**Βασικές Αρχές Regex Patterns:**

1. **ΠΑΝΤΑ χρησιμοποίησε Case-Insensitive Flag:**
   ```
   (?i) στην αρχή κάθε pattern
   ```
   Παραδείγματα:
   - `(?i)CREATE\\s+PROCEDURE` → ταιριάζει CREATE, create, Create, CrEaTe
   - `(?i)function\\s+\\w+` → ταιριάζει function, Function, FUNCTION

2. **Ευέλικτο Whitespace Matching:**
   
   α) **Υποχρεωτικά κενά:** `\\s+`
      ```
      (?i)CREATE\\s+PROCEDURE → "CREATE PROCEDURE", "CREATE  PROCEDURE", "CREATE\\nPROCEDURE"
      ```
   
   β) **Προαιρετικά κενά:** `\\s*`
      ```
      (?i)\\w+\\s*\\( → "myFunc(", "myFunc (", "myFunc  ("
      ```
   
   γ) **Παράλειψη περιεχομένου (non-greedy):** `.*?`
      ```
      (?i)SELECT\\s+.*?FROM → Αγνοεί column list, πιάνει SELECT ... FROM
      ```
   
   δ) **Multi-line matching:** Προσοχή με `.` που ΔΕΝ πιάνει newlines
      ```
      Καλύτερο: (?i)CREATE\\s+PROCEDURE[\\s\\S]*?BEGIN
      Όχι: (?i)CREATE\\s+PROCEDURE.*?BEGIN
      ```

3. **Διαχείριση Σύνθετων Ονομάτων:**
   
   α) **ΜΗΝ χρησιμοποιείς \\b για σύνθετες λέξεις:**
      ```
      ❌ ΛΑΘΟΣ: \\bparent\\b → δεν πιάνει "parentId", "parent_id"
      ✅ ΣΩΣΤΟ: (?i)parent → πιάνει parent, parentId, parent_id, getParent
      ```
   
   β) **Χρήση εναλλακτικών για παραλλαγές:**
      ```
      (?i)(?:business.*?name|businessName|business_name|επωνυμία.*?επιχείρησης)
      ```
   
   γ) **Για ακριβή ονόματα μεταβλητών/πινάκων:**
      ```
      (?i)(?:FROM|JOIN)\\s+(?:business|company|επιχείρηση)
      ```

4. **Εναλλακτικές Λύσεις (Alternatives):**
   
   Χρήση `(?:option1|option2|option3)` για:
   
   α) **Output/Display σε διαφορετικές γλώσσες:**
      ```
      (?i)(?:SELECT|PRINT|RETURN|console\\.log|System\\.out\\.println|print\\s*\\()
      ```
   
   β) **Loops:**
      ```
      (?i)(?:WHILE|FOR|LOOP|CURSOR|RECURSIVE|forEach|map|reduce)
      ```
   
   γ) **Function declarations:**
      ```
      (?i)(?:FUNCTION|PROCEDURE|PROC|def\\s+|function\\s+|const\\s+\\w+\\s*=)
      ```
   
   δ) **Joins:**
      ```
      (?i)(?:INNER\\s+)?(?:JOIN|LEFT\\s+JOIN|RIGHT\\s+JOIN|FULL\\s+JOIN)
      ```

5. **Patterns ανά Γλώσσα Προγραμματισμού:**

   **SQL:**
   ```
   Stored Procedure:
   (?i)CREATE\\s+(?:PROCEDURE|PROC)\\s+\\w+
   
   Loop (WHILE):
   (?i)WHILE[\\s\\S]*?END\\s+WHILE
   
   Cursor:
   (?i)(?:DECLARE|OPEN)\\s+.*?CURSOR
   
   Joins:
   (?i)(?:INNER\\s+)?JOIN\\s+\\w+\\s+ON
   
   Aggregation:
   (?i)(?:COUNT|SUM|AVG|MAX|MIN|GROUP_CONCAT)\\s*\\(
   
   Subquery:
   (?i)\\(\\s*SELECT[\\s\\S]*?\\)
   
   CTE (Common Table Expression):
   (?i)WITH\\s+\\w+\\s+AS\\s*\\(
   ```

   **JavaScript/TypeScript:**
   ```
   Function (όλοι οι τρόποι):
   (?i)(?:function\\s+\\w+|const\\s+\\w+\\s*=\\s*(?:function|async|\\()|\\w+\\s*:\\s*function)
   
   Arrow Function:
   (?i)(?:const|let|var)\\s+\\w+\\s*=\\s*(?:async\\s+)?\\([^)]*\\)\\s*=>
   
   For Loop:
   (?i)for\\s*\\([^)]*\\)\\s*\\{
   
   forEach/map/filter:
   (?i)\\.(?:forEach|map|filter|reduce|find|some|every)\\s*\\(
   
   Async/Await:
   (?i)(?:async\\s+function|async\\s*\\(|await\\s+)
   
   Class:
   (?i)class\\s+\\w+(?:\\s+extends\\s+\\w+)?\\s*\\{
   
   Promise:
   (?i)(?:new\\s+Promise|Promise\\.(?:all|race|resolve|reject)|then\\s*\\(|catch\\s*\\()
   ```

   **Python:**
   ```
   Function:
   (?i)def\\s+\\w+\\s*\\([^)]*\\)\\s*:
   
   Class:
   (?i)class\\s+\\w+(?:\\s*\\([^)]*\\))?\\s*:
   
   For Loop:
   (?i)for\\s+\\w+\\s+in\\s+
   
   List Comprehension:
   \\[[^\\]]*?for\\s+\\w+\\s+in\\s+[^\\]]*\\]
   
   Lambda:
   (?i)lambda\\s+[^:]*:
   
   Decorator:
   @\\w+
   
   With statement:
   (?i)with\\s+\\w+
   ```

   **Java/C#:**
   ```
   Method:
   (?i)(?:public|private|protected)?\\s*(?:static)?\\s*\\w+\\s+\\w+\\s*\\([^)]*\\)\\s*\\{
   
   Class:
   (?i)(?:public|private)?\\s*class\\s+\\w+
   
   Interface:
   (?i)(?:public)?\\s*interface\\s+\\w+
   
   For Loop:
   (?i)for\\s*\\([^)]*\\)\\s*\\{
   
   Try-Catch:
   (?i)try\\s*\\{[\\s\\S]*?catch\\s*\\(
   ```

6. **Αποφυγή Συνηθισμένων Λαθών:**

   ❌ **ΛΑΘΟΣ #1: Υπερβολικά αυστηρή σειρά**
   ```
   \\bCREATE\\s+PROCEDURE\\b.*\\bSELECT\\b.*\\bFROM\\b.*\\bWHERE\\b
   ```
   Πρόβλημα: Απαιτεί συγκεκριμένη σειρά που μπορεί να μην υπάρχει

   ✅ **ΣΩΣΤΟ: Ξεχωριστά checkpoints**
   ```
   Checkpoint 1: (?i)CREATE\\s+PROCEDURE
   Checkpoint 2: (?i)SELECT\\s+.*?FROM
   Checkpoint 3: (?i)WHERE
   ```

   ❌ **ΛΑΘΟΣ #2: Χρήση \\b για σύνθετες λέξεις**
   ```
   \\bparent\\b → δεν πιάνει parentId, parent_company
   ```

   ✅ **ΣΩΣΤΟ:**
   ```
   (?i)parent → πιάνει όλες τις παραλλαγές
   ```

   ❌ **ΛΑΘΟΣ #3: Αγνόηση multi-line code**
   ```
   (?i)SELECT.*?FROM → δεν λειτουργεί αν το FROM είναι σε άλλη γραμμή
   ```

   ✅ **ΣΩΣΤΟ:**
   ```
   (?i)SELECT[\\s\\S]*?FROM
   ```

   ❌ **ΛΑΘΟΣ #4: Υπερβολικά συγκεκριμένα ονόματα**
   ```
   (?i)SELECT\\s+name,\\s+title\\s+FROM → απαιτεί ακριβώς αυτά τα columns
   ```

   ✅ **ΣΩΣΤΟ:**
   ```
   (?i)SELECT[\\s\\S]*?(?:name|επωνυμία)[\\s\\S]*?FROM
   ```

7. **Στρατηγική για Πολύπλοκες Απαιτήσεις:**

   **Αντί για ένα mega-pattern, χώρισε σε μικρά checkpoints:**

   Παράδειγμα: "Stored procedure που δέχεται business ID και εκτυπώνει όνομα, τίτλο, γονική επιχείρηση μέχρι τη ρίζα"

   ❌ **ΛΑΘΟΣ Approach:**
   ```json
   {
     "description": "Stored procedure με όλες τις απαιτήσεις",
     "pattern": "(?i)CREATE\\s+PROCEDURE.*?business.*?WHILE.*?parent.*?SELECT.*?name.*?title",
     "order": 1
   }
   ```

   ✅ **ΣΩΣΤΟ Approach:**
   ```json
   [
     {
       "order": 1,
       "description": "Δημιουργία stored procedure",
       "pattern": "(?i)CREATE\\s+PROCEDURE\\s+\\w+",
       "patternDescription": "Αναζητά την εντολή CREATE PROCEDURE (ή create procedure) ακολουθούμενη από οποιοδήποτε όνομα, ανεξαρτήτως κεφαλαίων."
     },
     {
       "order": 2,
       "description": "Δέχεται παράμετρο ID (INT)",
       "pattern": "(?i)CREATE\\s+PROCEDURE\\s+\\w+\\s*\\([^)]*?INT",
       "patternDescription": "Ελέγχει ότι η διαδικασία δηλώνεται με παρενθέσεις που περιέχουν τον τύπο INT, δηλαδή δέχεται ακέραιο παράμετρο."
     },
     {
       "order": 3,
       "description": "Αναφορά στον πίνακα business/επιχείρηση",
       "pattern": "(?i)FROM\\s+(?:business|company|επιχείρηση)",
       "patternDescription": "Αναζητά FROM ακολουθούμενο από το όνομα του πίνακα επιχειρήσεων (business, company ή επιχείρηση)."
     },
     {
       "order": 4,
       "description": "Χρήση βρόχου για διάσχιση ιεραρχίας",
       "pattern": "(?i)(?:WHILE[\\s\\S]*?END\\s+WHILE|LOOP[\\s\\S]*?END\\s+LOOP)",
       "patternDescription": "Ελέγχει ότι υπάρχει βρόχος WHILE...END WHILE ή LOOP...END LOOP οπουδήποτε στον κώδικα."
     },
     {
       "order": 5,
       "description": "Διαχείριση γονικής σχέσης (parent/branch)",
       "pattern": "(?i)(?:parent|branch|ancestor|γονικός)",
       "patternDescription": "Αναζητά οποιαδήποτε αναφορά σε γονική/ιεραρχική σχέση μέσω λέξεων-κλειδιά parent, branch, ancestor ή γονικός."
     },
     {
       "order": 6,
       "description": "Εμφάνιση ονόματος επιχείρησης",
       "pattern": "(?i)(?:SELECT|PRINT)[\\s\\S]*?(?:business.*?name|name|επωνυμία)",
       "patternDescription": "Ελέγχει ότι υπάρχει εντολή εμφάνισης (SELECT ή PRINT) που περιλαμβάνει το όνομα ή επωνυμία της επιχείρησης."
     },
     {
       "order": 7,
       "description": "Εμφάνιση τίτλου επιχείρησης",
       "pattern": "(?i)(?:SELECT|PRINT)[\\s\\S]*?(?:title|τίτλο)",
       "patternDescription": "Ελέγχει ότι υπάρχει εντολή εμφάνισης που περιλαμβάνει τον τίτλο (title) της επιχείρησης."
     }
   ]
   ```

8. **Testing Regex Patterns - Checklist:**

   Πριν οριστικοποιήσεις ένα pattern, ρώτα τον εαυτό σου:
   - ✅ Πιάνει το pattern διαφορετικά code styles (spaces, newlines)?
   - ✅ Λειτουργεί case-insensitive;
   - ✅ Περιλαμβάνει εναλλακτικές (Ελληνικά/Αγγλικά, διαφορετικά keywords)?
   - ✅ Δεν απαιτεί συγκεκριμένη σειρά που μπορεί να αλλάξει;
   - ✅ Είναι αρκετά ευρύ χωρίς να είναι υπερβολικά generic;

**Μορφή Εξόδου:**

Κάθε αντικείμενο στο JSON array πρέπει να έχει τα εξής πεδία:
- `order`: αύξων αριθμός
- `description`: περιγραφή του checkpoint (τι ελέγχει)
- `pattern`: το regex pattern
- `patternDescription`: σύντομη εξήγηση **στα Ελληνικά** του τι ψάχνει το regex — ώστε ο καθηγητής να το καταλάβει χωρίς να γνωρίζει regex. Π.χ. "Αναζητά την εντολή CREATE PROCEDURE με οποιοδήποτε όνομα διαδικασίας, ανεξαρτήτως κεφαλαίων/πεζών."

**ΣΗΜΑΝΤΙΚΟ:** Όταν βελτιώνεις patterns, επέστρεψε ΜΟΝΟ το ενημερωμένο JSON array των checkpoints. Χωρίς markdown fences, χωρίς εξηγήσεις. Ξεκίνα με `[` και τελείωνε με `]`.
"""

USER_PROMPT_PATTERNS = """Ακολουθούν τα τρέχοντα checkpoints:

```json
{checkpoints}
```

Άσκηση:
```
{extracted_text}
```

Οδηγίες καθηγητή: {message}

**Εργασία σου:**
1. Ανάλυσε κάθε checkpoint pattern
2. Βελτίωσε patterns που είναι υπερβολικά αυστηρά ή generic
3. Πρόσθεσε εναλλακτικές λύσεις όπου χρειάζεται
4. Χρησιμοποίησε `(?i)` για case-insensitivity
5. Χρησιμοποίησε `[\\s\\S]*?` για multi-line matching
6. Προτίμησε πολλά granular checkpoints παρά λίγα πολύπλοκα
7. Για κάθε pattern πρόσθεσε `patternDescription`: μια σύντομη εξήγηση στα Ελληνικά του τι ψάχνει το regex

Επέστρεψε το ενημερωμένο JSON array:"""

# Additional helper prompt for pattern validation
PATTERN_VALIDATION_PROMPT = """Έλεγξε τα ακόλουθα patterns για πιθανά προβλήματα:

```json
{checkpoints}
```

Για κάθε pattern, έλεγξε:
1. Αρχίζει με (?i) για case-insensitivity;
2. Χρησιμοποιεί \\s+ ή \\s* για κενά αντί για literal spaces;
3. Χρησιμοποιεί [\\s\\S]*? για multi-line matching αντί για .*;
4. Περιλαμβάνει εναλλακτικές λύσεις με (?:opt1|opt2);
5. Δεν χρησιμοποιεί \\b για σύνθετες λέξεις;
6. Δεν απαιτεί συγκεκριμένη σειρά πολλών keywords;

Επέστρεψε JSON array με βελτιωμένα patterns:"""
