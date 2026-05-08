# Week 2 Write-up
Tip: To preview this markdown file
- On Mac, press `Command (⌘) + Shift + V`
- On Windows/Linux, press `Ctrl + Shift + V`

## INSTRUCTIONS

Fill out all of the `TODO`s in this file.

## SUBMISSION DETAILS

Name: **TODO** \
SUNet ID: **TODO** \
Citations: **TODO**

This assignment took me about **TODO** hours to do. 


## YOUR RESPONSES
For each exercise, please include what prompts you used to generate the answer, in addition to the location of the generated response. Make sure to clearly add comments in your code documenting which parts are generated.

### Exercise 1: Scaffold a New Feature
Prompt: 
```
beside the original `extract_action_items` function, add a new feature with the name `extract_action_items_llm`. the new feature should be able to finish similar item extraction tasks and it's powered by Ollama. the input and output types remain the same, and the output should be structured. in the system prompt, state that the unnecessary numbers and punctuations should be removed from the returned items.
think carefully. break the tasks and do everything step by step.
leave the test files and the original function untouched for this step.
``` 

Generated Code Snippets:
```
app/services/extract.py
l6, l8-9, l13-15, l94-145
```

### Exercise 2: Add Unit Tests
Prompt: 
```
update the unit test to cover the new feature. also, take different cases into consideration: empty input, bullet lists, keyword-prefixed lines, etc.
``` 

Generated Code Snippets:
```
tests/test_extract.py
l1-4, l7-14, l31-119
```

### Exercise 3: Refactor Existing Code for Clarity
Prompt: 
```
refactor the backend part of the app. list out the improvements coming with your changes and double check if it's reasonable to do so. please pay additional attention to well-defined API contracts/schemas, database layer cleanup, app lifecycle/configuration, and error handling.
``` 

Generated/Modified Code Snippets:
```
app/config.py
l1-40

app/schemas.py
l1-52

app/db.py
l4, l7, l9-37, l41, l46, l87, l91, l94, l102, l119, l128-129, l132, l135-136, l143, l145

app/main.py
l3, l4, l11, l13-18, l20, l26-29, l34, l37

app/routers/action_items.py
l3, l5, l8-15, l20-22, l24-30, l33-43, l48-56

app/routers/notes.py
l3, l6, l11-13, l15-32

app/services/extract.py
l2, l10-11, l13, l118
```


### Exercise 4: Use Agentic Mode to Automate a Small Task
Prompt: 
```
add a new endpoint for LLM powered extraction and a matching "Extract LLM" button on frontend, to complete the item extraction task by llm
add another endpoint to fetch all notes and a matching "List Notes" button on frontend
finish the two tasks step by step
``` 

Generated Code Snippets:
```
app/routers/action_items.py
l3-6, l9-19, l24-43, l45-6265-66, l69-75, l80-88

app/routers/notes.py
l3, l6, l11-15, l18-27, l30-39

frontend/index.html
l11, l15-20, l25, l31-33, l36, l39-41, l45-95, l98-128
```


### Exercise 5: Generate a README from the Codebase
Prompt: 
```
I would like you to write me a README file for the whole repo. please follow the common standard and cover the details. check if it includes (but not limited to) introduction/project setup/API endpoints and functionality/how to run the test unit
``` 

Generated Code Snippets:
```
README.md
l1-278
```


## SUBMISSION INSTRUCTIONS
1. Hit a `Command (⌘) + F` (or `Ctrl + F`) to find any remaining `TODO`s in this file. If no results are found, congratulations – you've completed all required fields. 
2. Make sure you have all changes pushed to your remote repository for grading.
3. Submit via Gradescope. 