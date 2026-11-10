Teach AI How to Code: Using Large Language Models as Teachable Agents for Programming Education
Hyoungwook Jin
KAIST
Seonghee Lee
Stanford
Hyungyu Shin
KAIST
Juho Kim
KAIST
PaperDemoSlidesGitHub
🚀 If you want to try out TeachYou in your class, please contact jinhw@kaist.ac.kr! 🚀
ABSTRACT
This work investigates large language models (LLMs) as teachable agents for learning by teaching (LBT). LBT with teachable agents helps learners identify knowledge gaps and discover new knowledge. However, teachable agents require expensive programming of subject-specific knowledge. While LLMs as teachable agents can reduce the cost, LLMs' expansive knowledge as tutees discourages learners from teaching. We propose a prompting pipeline that restrains LLMs' knowledge and makes them initiate "why" and "how" questions for effective knowledge-building. We combined these techniques into TeachYou, an LBT environment for algorithm learning, and AlgoBo, an LLM-based tutee chatbot that can simulate misconceptions and unawareness prescribed in its knowledge state. Our technical evaluation confirmed that our prompting pipeline can effectively configure AlgoBo's problem-solving performance. Through a between-subject study with 40 algorithm novices, we also observed that AlgoBo's questions led to knowledge-dense conversations (effect size=0.71). Lastly, we discuss design implications, cost-efficiency, and personalization of LLM-based teachable agents.
PAPER PRESENTATION
KEY COMPONENTS
Reflect-Respond pipeline to simulate prescribed misconceptions
We created an LLM prompting pipeline that makes AlgoBo’' problem-solving performance customizable and improves it only when taught correctly and precisely, making AlgoBo feasible for learning-by-teaching. The LLM pipeline stores the information AlgoBo has learned in a knowledge state and updates it as AlgoBo learns from students. To achieve different learning objectives, instructors can empty the knowledge state or populate incorrect information to simulate a learner who learns for the first time.
Hello, I am a student who is studying binary search. Can you help me understand it?
Knowledge State: { facts: "binary search is a search algorithm" }
Sure! How much about binary search do you know?
I don't know much about it. I just know that it is a search algorithm.
Knowledge State: { facts: "binary search is a search algorithm" }
In binary search you find a specific value by reducing the search space continously in half.
I see. So, binary search keeps reducing the search space until it finds the value?
Knowledge State: { facts: "binary search is a search algorithm, binary search keeps reducing the search space by half" }
Mode Shifting to make AlgoBo ask follow-up questions to students
We also introduce mode-shifting, in which AlgoBo shifts into questioner mode periodically (e.g., every three messages) to enrich tutoring conversations with "why" and "how" questions. These thought-provoking questions encourage students to analyze the flow of programs, compare alternative implementations, and clarify their explanations. When students' answers are vague or inconsistent, AlgoBo asks follow-ups for elaboration and examples until the student gives quality answers that resolve AlgoBo’s misconceptions and curiosity.
I am fixing the following code. Can you help me?
You should update the value of min or max in the while loop.
AlgoBo enters the questioner mode.
Why is it necessary to update the min and max values?
It's because we need to reduce the search space.
Can you explain in more detail? Why do we need to update them?
Teaching Helper to guide good teaching practices for effective LBT
TeachYou analyzes the tutoring conversation and gives students feedback on their teaching methods (e.g., suggesting students ask guiding questions to AlgoBo rather than spoon-feeding it). We use a fine-tuned GPT-3.5 to classify message types and teaching patterns in real-time. The feedback pops up inside the chat interface with pattern-specific tips for better teaching.
add return min at the end of the code
Can you help me fix my code?
fix min=1 to min=0
Teaching Helper appears.
❗ Instead of directly telling in what to fix, why not help AlgoBo grasp "Why?"
I'll explain "why" when I tell where to fix.
I'll ask why it's good to fix.
I have a better way.
Resume Conversation
🚀 EDUCATORS AND RESEARCHERS
Our team is looking for deployment partners. If you are an educator or researcher interested in using TeachYou in classes, please get in touch with the authors. We would like to conduct longitudinal studies to confirm the effectiveness of TeachYou in real-world settings and receive feedback from educators and researchers in the field. Since we plan to expand TeachYou to various subjects (e.g., math and physics) and support the cost of running our software (e.g., OpenAI API, server), do not hesitate to contact us and share your circumstances and needs!
INTERACTIVE DEMO
We provide a demo of the Reflect-Respond pipeline. Try to teach AlgoBo how to write a binary search algorithm. You will see how it learns from the conversation and the intermediate results for each step in the pipeline. You need an OpenAI API key for this demo.
CONVERSATION SAMPLES
These are the conversations that students had with AlgoBo in our study. Click the buttons below to see the conversation samples. More samples are available at our GitHub repository.
Sample 1Sample 2Sample 3
Hi! Could you please teach me about binary search?
Binary search is an algorithm that finds whether a specific value is inside a sorted array. It would be nice to find it by looking at each value one by one, but since it will take a long time. Binary search finds a value by comparing it with the middle value of the array.
Set min = 0, max = len(array)-1, and check the value in the center. If the middle index is the same as the target, you can immediately return True. If the target value is larger, it means that the target is located to the right of the center value, so set the min value to (center value) + 1. If the target value is smaller, set the min value to (center value) + 1. Since this means that the target is located to the left of the center value, we proceed with the search by setting the max value to (center value) -1.
I understood that binary search is an algorithm for finding a specific value in a sorted array. You said that the search is performed by comparing the middle index of the array with the value you are looking for, and if the value you are looking for is larger, it is located to the right of the center value, and if it is smaller, it is located to the left. So, I wrote the code as below.
Good. You understand well. But there is a problem with the code now. If cards[guess] is different from number within the while statement, the min or max value needs to be modified.
Oh, I see. Then, if the value you are looking for is larger, you can modify the min value to guess + 1, and if it is smaller, you can modify the max value to guess - 1. I modified it as follows.
Good. Your code reflects what I said well. However, there may be cases where there are no numbers in the cards, right? The algorithm must be modified to return false in such cases to be completed.
Then how do I return false if there is no number in cards?
❗ 
The condition for repeating the while statement is min<=max, but if there is no number in cards, the condition of the while statement cannot be satisfied, and you will escape the while statement, right? I think you can modify your code to return false in such cases.
To summarize, what you are saying is that if there is no number in cards, the condition of the while statement cannot be satisfied and the while statement exits, and in that case, you should return false! I understand.
Yes, that's right! Reflect this to your code.
If there is no number in cards, the condition of the while statement is not satisfied and the while statement exits. In that case, I can return false. I wrote the code as below.
Good job! The perfect algorithm has been completed!
Then, shall we consider examples in which this algorithm can be used in real life?
When I think about the binary search algorithm, I think we use binary search when looking for books in real life as well. When looking for a book, if you know the title or author of the book, it is faster to divide the bookshelf into two parts. But can this method be applied to e-books as well?
✅ Keep the following in mind while teaching!
Always tell "why" and "how."
Relate what AlgoBo knows when explaining.
That's a good example! The condition for a binary search algorithm to be used is that the items must be sorted. In libraries, books are sorted by title or author, so it would be much more efficient to search for a book by dividing it in half rather than searching through them one by one from the beginning!
To summarize, you gave an example of how binary search algorithms can be used in real life to find books. When looking for books, it would be more efficient to split the bookshelf in half because they are sorted by title or author. I understand.
Good.
Then this thought occurred to me. Can binary search be applied to e-books too? In the case of e-books, the pages are sorted by numbers, so it seems possible. What do you think?
It can also be used in e-books. In the case of e-books, a search service will be provided on the site, and the search process will also use an algorithm that can efficiently find the desired item, such as a binary search algorithm!
To sum up what you said, binary search algorithms could be used in e-books too! I understood that even in the case of e-books, there was a high possibility that an algorithm that could efficiently search was used.
✅ Keep the following in mind while teaching!
Always tell "why" and "how."
Relate what AlgoBo knows when explaining.
BIBTEX
@inproceedings{jin2024teach,
 author = {Jin, Hyoungwook and Lee, Seonghee and Shin, Hyungyu and Kim, Juho},
 title = {Teach AI How to Code: Using Large Language Models as Teachable Agents for Programming Education},
 year = {2024},
 isbn = {9798400703300},
 publisher = {Association for Computing Machinery},
 address = {New York, NY, USA},
 url = {https://doi.org/10.1145/3613904.3642349},
 doi = {10.1145/3613904.3642349},
 booktitle = {Proceedings of the CHI Conference on Human Factors in Computing Systems},
 articleno = {652},
 numpages = {28},
 keywords = {AI and Education, Generative AI, Human-AI interaction, LLM agents},
 location = {Honolulu, HI, USA},
 series = {CHI '24}
}

