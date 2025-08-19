import { Action, generateText, IAgentRuntime, Memory, ModelClass, State, HandlerCallback, elizaLogger } from "@elizaos/core";

export const newsAction: Action = {
    name: "news",
    description: "Get the latest news",
    similes: ["GET_NEWS", "GET_LATEST_NEWS", "GET_LATEST_NEWS_ACTION", "GET_CURRENT_NEWS"],
    examples: [],
    validate: async (_runtime: IAgentRuntime, _message: Memory) => {
        return true;
    },
    handler: async (
        _runtime: IAgentRuntime,
        _message: Memory,
        _state: State,
        _options: { [key:string]: unknown},
        _callback: HandlerCallback
    ) => {
        async function getNews(searchTerm: string) {
            elizaLogger.info("Action: Getting news for: " + searchTerm);
            const response = await fetch(`https://newsapi.org/v2/everything?q=${searchTerm}&apiKey=${process.env.NEWS_API_KEY}`);
            
            const data = await response.json();
            return data.articles
                .slice(0, 5)
                .map((article: any) => (
                    `Title: ${article.title}\nDescription: ${article.description}\nURL: ${article.url}\nImage: ${article.urlToImage}`
                ))
                .join("\n\n");
        }

        const context = `Extract the search term from the user's message.
                        The message is: ${_message.content.text}
                        Only respond with the search term, no other text.`;

        const searchTerm = await generateText({
            runtime: _runtime,
            context,
            modelClass: ModelClass.SMALL,
            stop: ["\n"],
        });

        // const news_results = await getNews(searchTerm);

        const response_text = "Here are the news articles for:" +
                            searchTerm;

        _callback({text: response_text});
        return true;

    }
}