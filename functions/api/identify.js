export default {

    async fetch(request, env) {

        if (request.method !== "POST") {

            return jsonResponse({

                success: false,
                message: "Only POST requests are allowed."

            }, 405);

        }

        try {

            const formData = await request.formData();

            const image = formData.get("plantImage");

            if (!image) {

                return jsonResponse({

                    success: false,
                    message: "No image uploaded."

                }, 400);

            }

            const apiKey = env.PLANTNET_API_KEY;

            if (!apiKey) {

                return jsonResponse({

                    success: false,
                    message: "PlantNet API key is missing."

                }, 500);

            }

            const plantResult = await identifyPlant(

                image,
                apiKey

            );

            if (!plantResult) {

                return jsonResponse({

                    success: false,
                    message: "Plant not found."

                }, 404);

            }

            const wikiName =

                plantResult.common_name !== "No common name found"

                ? plantResult.common_name

                : plantResult.scientific_name;

            const wikiData = await getWikipediaInformation(

                wikiName

            );

            return jsonResponse({

                success: true,

                common_name: plantResult.common_name,

                scientific_name: plantResult.scientific_name,

                family_name: plantResult.family_name,

                confidence: plantResult.confidence,

                wiki_summary: wikiData.summary,

                history: wikiData.history,

                benefits: wikiData.benefits

            });

        }

        catch (error) {

            console.error(error);

            return jsonResponse({

                success: false,

                message: error.message

            }, 500);

        }

    }

};



/* ==========================================
   Helper Functions
========================================== */

function jsonResponse(data, status = 200) {

    return new Response(

        JSON.stringify(data),

        {

            status,

            headers: {

                "Content-Type": "application/json"

            }

        }

    );

}

/* ==========================================
   PlantNet API
========================================== */

async function identifyPlant(image, apiKey) {

    const form = new FormData();

    form.append(
        "images",
        image,
        image.name
    );

    form.append(
        "organs",
        "auto"
    );

    const response = await fetch(

        `https://my-api.plantnet.org/v2/identify/all?api-key=${apiKey}`,

        {

            method: "POST",

            body: form

        }

    );

    if (!response.ok) {

        return null;

    }

    const data = await response.json();

    if (

        !data.results ||

        data.results.length === 0

    ) {

        return null;

    }

    const best = data.results[0];

    const confidence = Number(

        (best.score * 100).toFixed(2)

    );

    let commonName = "No common name found";

    if (

        best.species.commonNames &&

        best.species.commonNames.length > 0

    ) {

        commonName = best.species.commonNames[0];

    }

    return {

        common_name: commonName,

        scientific_name:
            best.species.scientificNameWithoutAuthor,

        family_name:
            best.species.family.scientificNameWithoutAuthor,

        confidence

    };

}

/* ==========================================
   Wikipedia Engine
========================================== */

async function getWikipediaInformation(plantName) {

    let summary =
        "Information will be added in a future update.";

    let history =
        "Information will be added in a future update.";

    let benefits =
        "Information will be added in a future update.";

    try {

        // ==========================
        // Wikipedia Summary
        // ==========================

        const summaryResponse = await fetch(

            `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(plantName)}`,

            {

                headers: {

                    "User-Agent":
                        "PlantIdentificationOnline/1.0"

                }

            }

        );

        if (summaryResponse.ok) {

            const summaryData =
                await summaryResponse.json();

            summary =
                summaryData.extract || summary;

        }

        // ==========================
        // Complete Wikipedia Article
        // ==========================

        const articleResponse = await fetch(

            `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&format=json&titles=${encodeURIComponent(plantName)}`,

            {

                headers: {

                    "User-Agent":
                        "PlantIdentificationOnline/1.0"

                }

            }

        );

        if (!articleResponse.ok) {

            return {

                summary,
                history,
                benefits

            };

        }

        const articleData =
            await articleResponse.json();

        const page =
            Object.values(
                articleData.query.pages
            )[0];

        const article =
            page.extract || "";

        if (!article) {

            return {

                summary,
                history,
                benefits

            };

        }

        const sentences =
            article.split(".");
                    // ==========================
        // Extract History
        // ==========================

        history = extractSentences(

            sentences,

            [

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

            ],

            history

        );

        // ==========================
        // Extract Benefits
        // ==========================

        benefits = extractSentences(

            sentences,

            [

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

            ],

            benefits

        );

    }

    catch (error) {

        console.error(error);

    }

    return {

        summary,

        history,

        benefits

    };

}



/* ==========================================
   Sentence Extraction Utility
========================================== */

function extractSentences(

    sentences,

    keywords,

    fallback

) {

    const results = [];

    for (const sentence of sentences) {

        const text = sentence.trim();

        if (!text) continue;

        for (const keyword of keywords) {

            if (

                text

                    .toLowerCase()

                    .includes(

                        keyword.toLowerCase()

                    )

            ) {

                const clean = text + ".";

                if (

                    !results.includes(clean)

                ) {

                    results.push(clean);

                }

                break;

            }

        }

    }

    if (results.length === 0) {

        return fallback;

    }

    return "• " + results.join("\n\n• ");

}

/* ==========================================
   End of Worker
========================================== */

// No more code is required below this point.
// All helper functions have been defined above.