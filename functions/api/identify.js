export async function onRequestPost(context) {

    const { request, env } = context;

    try {

        // Read submitted form
        const formData = await request.formData();

        const image = formData.get("plantImage");

        if (!image) {

            return Response.json({
                success: false,
                message: "No image uploaded."
            }, {
                status: 400
            });

        }

        // Read PlantNet API Key
        const apiKey = env.PLANTNET_API_KEY;

        if (!apiKey) {

            return Response.json({
                success: false,
                message: "PlantNet API key not configured."
            }, {
                status: 500
            });

        }

        // Prepare request for PlantNet
        const plantNetForm = new FormData();

        plantNetForm.append(
            "images",
            image,
            image.name
        );

        plantNetForm.append(
            "organs",
            "auto"
        );

        const plantNetURL =
            `https://my-api.plantnet.org/v2/identify/all?api-key=${apiKey}`;

        const plantResponse = await fetch(
            plantNetURL,
            {
                method: "POST",
                body: plantNetForm
            }
        );

        if (!plantResponse.ok) {

            return Response.json({
                success: false,
                message: "PlantNet request failed."
            }, {
                status: 500
            });

        }

        const plantResult = await plantResponse.json();

         if (
            !plantResult.results ||
            plantResult.results.length === 0
        ) {

            return Response.json({
                success: false,
                message: "Plant not found."
            });

        }

        const best = plantResult.results[0];

        const confidence =
            Number((best.score * 100).toFixed(2));

        const scientificName =
            best.species.scientificNameWithoutAuthor;

        const family =
            best.species.family.scientificNameWithoutAuthor;

        let commonName = "No common name found";

        if (
            best.species.commonNames &&
            best.species.commonNames.length > 0
        ) {

            commonName = best.species.commonNames[0];

        }

        // We will use this name for Wikipedia
        const wikiPlantName =
            commonName !== "No common name found"
                ? commonName
                : scientificName; 

                // ============================
        // Wikipedia Description
        // ============================

        let wikiSummary = "Information will be added in a future update.";

        try {

            const wikiURL =
                `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiPlantName)}`;

            const wikiResponse = await fetch(
                wikiURL,
                {
                    headers: {
                        "User-Agent": "PlantIdentificationOnline/1.0"
                    }
                }
            );

            if (wikiResponse.ok) {

                const wikiData = await wikiResponse.json();

                wikiSummary =
                    wikiData.extract ||
                    "Information will be added in a future update.";

            }

        } catch (error) {

            wikiSummary =
                "Information will be added in a future update.";

        }

        // Get complete Wikipedia article
        let wikiText = "";

        try {

            const extractURL =
                `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&format=json&titles=${encodeURIComponent(wikiPlantName)}`;

            const extractResponse = await fetch(
                extractURL,
                {
                    headers: {
                        "User-Agent": "PlantIdentificationOnline/1.0"
                    }
                }
            );

            if (extractResponse.ok) {

                const extractData = await extractResponse.json();

                const pages = extractData.query.pages;

                const page = Object.values(pages)[0];

                wikiText = page.extract || "";

            }

        } catch (error) {

            wikiText = "";

        }        // ============================
        // History & Region
        // ============================

        let history = "Information will be added in a future update.";

        if (wikiText.length > 0) {

            const sentences = wikiText.split(".");

            const keywords = [

                "first described",
                "history",
                "historically",
                "ancient",

                "native to",
                "native throughout",
                "originated in",
                "indigenous to",
                "endemic to",
                "found in",
                "distributed in",
                "grew in",
                "the indigenous range",
                "antiquity",
                "grows natively",
                "habitat",

                "china",
                "india",
                "pakistan",
                "america",
                "united states",
                "europe",
                "africa",
                "asia",
                "rare"

            ];

            const results = [];

            for (const sentence of sentences) {

                for (const keyword of keywords) {

                    if (
                        sentence.toLowerCase().includes(
                            keyword.toLowerCase()
                        )
                    ) {

                        const cleanSentence =
                            sentence.trim() + ".";

                        if (
                            cleanSentence.length > 5 &&
                            !results.includes(cleanSentence)
                        ) {

                            results.push(cleanSentence);

                        }

                        break;

                    }

                }

            }

            if (results.length > 0) {

                history =
                    "• " + results.join("\n\n• ");

            }

        }        // ============================
        // Benefits & Uses
        // ============================

        let benefits = "Information will be added in a future update.";

        if (wikiText.length > 0) {

            const sentences = wikiText.split(".");

            const keywords = [

                "medicinal",
                "medicine",
                "used for",
                "used in",
                "used as",
                "edible",
                "food",
                "fruit",
                "oil",
                "tea",
                "herbal",
                "treatment",
                "ornamental",
                "timber",
                "wood",
                "essential oil",
                "health benefits"

            ];

            const results = [];

            for (const sentence of sentences) {

                for (const keyword of keywords) {

                    if (
                        sentence.toLowerCase().includes(
                            keyword.toLowerCase()
                        )
                    ) {

                        const cleanSentence =
                            sentence.trim() + ".";

                        if (
                            cleanSentence.length > 5 &&
                            !results.includes(cleanSentence)
                        ) {

                            results.push(cleanSentence);

                        }

                        break;

                    }

                }

            }

            if (results.length > 0) {

                benefits =
                    "• " + results.join("\n\n• ");

            }

        }        // ============================
        // Return JSON Response
        // ============================

        return Response.json({

            success: true,

            common_name: commonName,

            scientific_name: scientificName,

            family_name: family,

            confidence: confidence,

            wiki_summary: wikiSummary,

            history: history,

            benefits: benefits

        });

    } catch (error) {

        console.error(error);

        return Response.json({

            success: false,

            message: "Internal Server Error",

            error: error.message

        }, {

            status: 500

        });

    }

}
                
