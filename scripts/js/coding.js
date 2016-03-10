// Coding refers to the coding group, annotating tweets
var coding, options, data;

function Coding() {
    this.events = [];
    this.rumors = [];
    this.rumor = {};
    this.coders = [];
    this.raw_codes = {};
    
    this.rumor_period_counts = {};
    
    this.tooltip = new Tooltip();
    
    this.code_list = {
        primary: ['Uncodable', 'Unrelated', 'Affirm', 'Deny', 'Neutral'],
        primary6: ['No Code', 'Uncodable', 'Unrelated', 'Affirm', 'Deny', 'Neutral'],
        binary: ['Uncodable', 'Unrelated', 'Affirm', 'Deny', 'Neutral', 'Uncertainty'],
        display: ['Primary', 'Uncodable', 'Unrelated', 'Affirm', 'Deny', 'Neutral', 'Uncertainty'],
        any: ['Uncodable', 'Unrelated', 'Affirm', 'Deny', 'Neutral', 'Implicit', 'Ambiguity', 'Uncertainty', 'Difficult'],
    };
    this.n = {
        tweets: 0,
        coders: 0,
        codes: 0,
        codes_per_tweet: 0,
        primary: 5
    };
    this.nnn = 0;
    this.ngrams = {};
}
Coding.prototype = {
    buildPage: function() {
        options.panels = ['Dataset', 'Reliability', 'Matrices', 'Tweets', 'Tweet Types', 'N-Grams'];
        
        var divs = d3.select('body')
            .append('div')
            .attr('id', 'body')
            .attr('class', 'container')
            .selectAll('div')
            .data(options.panels.slice(1))
            .enter()
            .append('div')
            .attr('id', function(d) { return util.simplify(d); })
            .style({
                opacity: 0,
                transform: 'scaleY(0)',
                'transform-origin': 'top',
                display: 'none'
            });
        
        divs.append('div')
            .attr('id', function(d) { return util.simplify(d) + '_header'; })
            .attr('class', 'page-header coding_header')
            .append('h2')
            .html(function(d) { return d; });
        
        divs.append('div')
            .attr('id', function(d) { return util.simplify(d) + '_body'; });
        
        coding.tooltip.init();
        coding.getData();
    },
    getData: function() {
        var progress = 0;
        
        data.callPHP('coding/getCoders', {}, function(d) {
            try {
                coding.coders = JSON.parse(d);
            } catch(err) {
                console.log(file_data);
                return;
            }
            progress++
            if(progress == 4)
                coding.buildOptions();
        });
            
        data.callPHP('collection/getEvents', {}, function(file_data) {
            try {
                coding.events = JSON.parse(file_data);
            } catch(err) {
                console.log(file_data);
                return;
            }
            progress++
            if(progress == 4)
                coding.buildOptions();
        });

        data.callPHP('collection/getRumors', {}, function(file_data) {
            try {
                coding.rumors = JSON.parse(file_data);
            } catch(err) {
                console.log(file_data);
                return;
            }
            progress++
            if(progress == 4)
                coding.buildOptions();
        });

        // Get the number of codes for each rumor
        data.callPHP('coding/rumorPeriodCounts', {}, function(file_data) {
            try {
                coding.rumor_period_counts = JSON.parse(file_data);
            } catch(err) {
                console.log(file_data);
                return;
            }
            
            progress++
            if(progress == 4)
                coding.buildOptions();
        });
    },
    buildOptions: function() {
        // Rumors
        coding.rumors.sort(function(a, b) {
            if(a.Event_ID == b.Event_ID) {
                if(a.Name > b.Name) return 1;
                if(a.Name < b.Name) return -1;
                return 0;
            }
            return parseInt(a.Event_ID) - parseInt(b.Event_ID);
        })
        var rumor_labels = coding.rumors.map(function(rumor) {
            rumor.event = coding.events.filter(function(event){
                return event.ID == rumor.Event_ID;
            })[0];
            return rumor.event.DisplayName + ": " + rumor.Name;
        });
        var rumor_ids = coding.rumors.map(function(rumor) {
            return rumor.ID;
        });
        var rumor_available = [];
        
        coding.rumors.forEach(function(rumor, i_r) {
            rumor.periods = [];
            coding.rumor_period_counts.forEach(function(count) {
                if(count.Rumor == rumor.ID)
                    rumor.periods.push(parseInt(count.Period));
            });
            if(rumor.periods.length) {
                rumor_available.push(i_r);
            }
        });
        
        // Coders
        var coder_labels = coding.coders.map(function(coder) {
            return coder.Name;
        });
        coder_labels.unshift('All');
        var coder_ids = coding.coders.map(function(coder) {
            return coder.ID;
        });
        coder_ids.unshift('all');
        
        // Make Panel Options
        options['Dataset'] = {
            Rumor: new Option({
                title: 'Rumor',
                labels: rumor_labels,
                ids:    rumor_ids,
                available: rumor_available,
                default: 0,
                type: "dropdown",
                callback: coding.chooseRumor
            }),
            Period: new Option({
                title: 'Period',
                labels: ['Adjudicated', 'Auxiliary Adjudication', 'Coding', 'Training 1', 'Training 2', 'Training 3', 'Training 4'],
                ids:    [1, 2, 0, -1, -2, -3, -4],
                isnumeric: true,
                default: 1,
                type: "dropdown",
                callback: coding.getCodes
            })
        };
        options['Reliability'] = {
            Show: new Option({
                title: 'Show',
                styles: ["btn btn-sm", "btn btn-sm btn-default"],
                labels: ["No", "Yes"],
                ids:    ["false", "true"],
                default: 1,
                type: "toggle",
                callback: function() { coding.togglePane('Reliability', 1000); }
            }),
            Coder: new Option({
                title: 'Coder',
                labels: coder_labels,
                ids:    coder_ids,
                isnumeric: true,
                default: 0,
                type: "dropdown",
                callback: coding.compileReport
            })
        };
        options['Matrices'] = {
            Show: new Option({
                title: 'Show',
                styles: ["btn btn-sm", "btn btn-sm btn-default"],
                labels: ["No", "Yes"],
                ids:    ["false", "true"],
                default: 0,
                type: "toggle",
                callback: function() { coding.togglePane('Matrices', 1000); }
            }),
            Order: new Option({
                title: "Order",
                labels: ["Alphabetic", "Agreement", "Anonymous", "Cluster"],
                ids:    ['alpha', 'agreement', 'anonymous', 'cluster'],
                default: 2,
                available: [0, 1, 2],
                parent: '#matrices_header',
                callback: coding.compileReport
            })
        };
        
        var tweet_codes = ["Any", "Primary", "Uncodable", "Unrelated", 'Related', "Affirm", "Deny", "Neutral", "Uncertainty"];
        options['Tweets'] = {
            Show: new Option({
                title: 'Show',
                styles: ["btn btn-sm", "btn btn-sm btn-default"],
                labels: ["No", "Yes"],
                ids:    ["false", "true"],
                default: 0,
                type: "toggle",
                callback: function() { coding.togglePane('Tweets', 1000); }
            }),
            Code: new Option({
                title: 'Code',
                labels: tweet_codes,
                ids:    tweet_codes,
                default: 0,
                type: "dropdown",
                callback: coding.fillTweetList
            }),
            Focus: new Option({
                title: 'Focus',
                labels: ['All', 'Majority Coded', 'Disagreement'],
                ids:    ["All", "Majority", "Disagreement"],
                default: 0,
                type: "dropdown",
                callback: coding.fillTweetList
            }),
            Order: new Option({
                title: "Order",
                labels: ['Tweet ID', 'Text', 'Majority Code', 'Disagreement'],
                ids:    ['tweet_id', 'text', 'majority', 'disagreement'],
                default: 3,
                callback: coding.fillTweetList
            })
        };
        options['Tweet Types'] = {
            Show: new Option({
                title: 'Show',
                styles: ["btn btn-sm", "btn btn-sm btn-default"],
                labels: ["No", "Yes"],
                ids:    ["false", "true"],
                default: 0,
                type: "toggle",
                callback: function() { coding.togglePane('Tweet Types', 1000); }
            }),
            'More Information': new Option({
                title: 'Get More Information (Takes Time)',
                labels: ['Yes', 'No'], ids: ['true', 'false'],
                default: 0,
                type: 'dropdown',
                hidden: true,
                callback: coding.getMoreInformation
            }),
            Bars: new Option({
                title: "Show Bars For",
                labels: ['% of All', '% within each Tweet Type', '% within each Code', 'None'],
                ids:    ['all', 'tweet_type', 'code', 'none'],
                default: 0,
                callback: coding.tweetTypeTable
            })
        };
        var subsets = tweet_codes.map(function(d) { return 'Coded: ' + d; });
        subsets[0] = 'All';
        options['N-Grams'] = {
            Show: new Option({
                title: 'Show',
                styles: ["btn btn-sm", "btn btn-sm btn-default"],
                labels: ["No", "Yes"],
                ids:    ["false", "true"],
                default: 0,
                type: "toggle",
                callback: function() { coding.togglePane('N-Grams', 1000); }
            }),
            TopX: new Option({
                title: "Top",
                labels: ['10', '20', '100', '200', '1000'],
                ids:    ['10', '20', '100', '200', '1000'],
                default: 1,
                callback: coding.NGramList
            }),
            Filter: new Option({
                title: "Filter",
                labels: ['None', 'Redundant Tweets'],
                ids:    ['none', 'redun'],
                default: 1,
                callback: coding.countNGrams
            }),
            'Exclude Stopwords': new Option({
                title: "Stopwords",
                styles: ["btn btn-sm btn-default", "btn btn-sm"],
                labels: ["Include",
                         "Exclude"],
                ids:    ['false', 'true'],
                default: 1,
                type: 'toggle',
                callback: coding.NGramList
            }),
            Tables: new Option({
                title: "Tables",
                labels: ['n-grams', 'n-grams & co-occur', 'n-grams, co & tweets', 'n-grams, co & urls', 'All'],
                ids:    ['n', 'nc', 'nct', 'ncu', 'nctu'],
                default: 1,
                callback: coding.NGramList
            }),
            TF: new Option({
                title: "Term Frequency",
                labels: ['&sum; Has', '&sum; Count'],
                ids:    ['has', 'count'],
                default: 0,
                breakbefore: true,
                callback: coding.NGramList
            }),
            'TF Modifier': new Option({
                title: "TF Modifier",
                labels: ['Raw', 'Fraction', 'Percent', 'Log'],
                ids:    ['raw', 'fraction', 'percent', 'log'],
                default: 0,
                callback: coding.NGramList
            }),
            Subset: new Option({
                title: "In",
                labels: subsets,
                ids:    subsets,
                default: 0,
                callback: coding.countNGrams
            }),
            DF: new Option({
                title: "Doc Frequency",
                labels: ['None', '&sum; Has', '&sum; Count'],
                ids:    ['none', 'has', 'count'],
                default: 0,
                breakbefore: true,
                callback: coding.NGramList
            }),
            'IDF': new Option({
                title: "Inverse",
                labels: ['1 / DF', '#Docs / DF', 'Log(#Docs / DF)'],
                ids:    ['inv', 'ratio', 'log-ratio'],
                default: 0,
                callback: coding.NGramList
            }),
            Document: new Option({
                title: "Document",
                labels: rumor_labels,
                ids:    rumor_ids.map(function(d) { return 'Doc: ' + d; }),
                available: rumor_available,
                default: 0,
                callback: coding.countNGrams
            }),
            DocumentSubset: new Option({
                title: "In",
                labels: subsets,
                ids:    subsets.map(function(d) { return 'Doc' + d; }),
                default: 0,
                callback: coding.countNGrams
            })
        };
        
        // Start drawing
        options.init();
        
        coding.chooseRumor();
    },
    chooseRumor: function() {
        coding.rumor = {};
        coding.rumors.forEach(function(rumor) {
            if(options['Dataset']['Rumor'].is(rumor.ID))
               coding.rumor = rumor;
        });
        
        // Set document counter
        options['N-Grams']['Document'].updateInInterface(options['Dataset']['Rumor'].indexCur());
        
        // Set period
        var period_option = options['Dataset']['Period'];
        period_option.available = [];
        period_option.ids.forEach(function(period, i) {
            if(coding.rumor.periods.includes(period))
                period_option.available.push(i);
        });
        if(period_option.available.includes(period_option.indexCur())) {
            period_option.default = period_option.indexCur();
        } else {
            period_option.default = period_option.available[0];
        }
        options.buildSidebarOption('Dataset', 'Period');
        period_option.click(period_option.default);
    },
    getCodes: function() {
        var post = {
            rumor_id: options['Dataset']['Rumor'].get(),
            period: options['Dataset']['Period'].get()
        };

        data.callPHP('coding/get', post, coding.parseCodes);
    },
    parseCodes: function(file_data) {
        try {
            coding.raw_codes = JSON.parse(file_data);
        } catch(err) {
            console.log(file_data);
            return;
        }
        
        // Only enable the coders that coded for the rumor
        var unique_coders = coding.raw_codes.reduce(function(set, code) {
            set.add(code['Coder']);
            return set;
        }, new Set());
        unique_coders.add('0'); // All 0 for all
        var available = Array.from(unique_coders).map(function(coder_id) {
            return parseInt(coder_id);
        });
        available.sort(function(a, b) { return a - b; });
        options['Reliability']['Coder'].available = available;
        options.buildSidebarOption('Reliability', 'Coder');
        
        // Compile the report
        coding.compileReport();
    },
    compileReport: function() {
        
        // Get tweets for this report
        var coder_id = options['Reliability']['Coder'].get();
        coding.tweets = {};
        coding.tweets_arr = [];
        coding.raw_codes.forEach(function(code) {
            if(!(code.Tweet in coding.tweets) && 
               (coder_id == 'all' || code['Coder'] == coder_id)) {
                var newTweet = {
                    Text: code.Text,
                    Tweet_ID: code.Tweet,
                    Votes: {
                        Coders: [],
                        Count: 0,
                        Primary: [],
                        'No Code': [],
                        Uncodable: [],
                        Unrelated: [],
                        Affirm: [],
                        Deny: [],
                        Neutral: [],
                        Implicit: [],
                        Ambiguity: [],
                        Uncertainty: [],
                        Difficult: []
                    },
                    Plurality: {
                        Count: 0,
                        Primary: '',
                        'No Code': [],
                        Uncodable: false,
                        Unrelated: false,
                        Affirm: false,
                        Deny: false,
                        Neutral: false,
                        Uncertainty: false,
                        Others: ''
                    },
                    Primary_Disagreement: false,
                    Uncertainty_Disagreement: false,
                };
                coding.tweets[code.Tweet] = newTweet;
                coding.tweets_arr.push(newTweet);
            }
        });
        
        // Add votes for each to the tweets
        coding.raw_codes.forEach(function(code) {
            if(code.Tweet in coding.tweets) {
                tweet = coding.tweets[code.Tweet];
                tweet.Votes.Coders.push(parseInt(code.Coder));
                tweet.Votes.Count++;
                tweet.Votes.Primary.push(code.Primary);
                if(code.Primary == 'No Code')
                    tweet.Votes['No Code'].push(parseInt(code.Coder));
                
                coding.code_list.any.forEach(function(c) {
                    if(code[c] == '1') {
                        tweet.Votes[c].push(parseInt(code.Coder));
                    }
                });
            }
        });
        
        // Initialize objects
        coding.n.codes = 0;
        coding.n.tweets = coding.tweets_arr.length
761;
        coding.n.coders = coding.coders.length;
        coding.coders_x_coders_possible = util.zeros(coding.n.coders, coding.n.coders);
        coding.coders_x_coders_primary = util.zeros(coding.n.coders, coding.n.coders);
        coding.coders_x_majority_primary = util.zeros(coding.n.coders, 1);
        coding.coders_x_majority_uncertainty = util.zeros(coding.n.coders, 1);
        coding.coders_x_coders_uncertainty_first = util.zeros(coding.n.coders, coding.n.coders);
        coding.coders_x_coders_uncertainty_both = util.zeros(coding.n.coders, coding.n.coders);
        coding.codes_x_codes = util.zeros(coding.n.primary, coding.n.primary);
        
        var code_agreement = {};
        var code_agreement_arr = [];
        coding.code_list.display.forEach(function(code) {
            var entry = {
                Code: code,
                Count: 0,
                All: 0,
                Average: 0,
                Unanimous: 0,
                NotUnanimous: 0,
                Plurality: 0,
                JustPlurality: 0,
                Any: 0,
                Minority: 0,
                
                JustCoder: 0,
                JustOther: 0,
                
                Alpha: 0,
                Agreement: 0
            };
            code_agreement[code] = entry;
            code_agreement_arr.push(entry);
        });
        
        // Find majority agreement
        coding.tweets_arr.forEach(function(tweet) {                        
            // Get the plurality
            coding.n.codes += tweet.Votes['Count'];
            tweet.Plurality['Count'] = d3.max(coding.code_list.primary6, function(code) { return tweet.Votes[code].length; });
            coding.code_list.primary6.forEach(function(code) {
                tweet.Plurality[code] = tweet.Votes[code].length == tweet.Plurality['Count'];
                if(!tweet.Plurality['Primary'] && tweet.Plurality[code])
                    tweet.Plurality['Primary'] = code;
            })
            tweet.Plurality['Uncertainty'] = tweet.Votes['Uncertainty'].length / tweet.Votes['Count'] >= 0.5;
            tweet.Primary_Disagreement     = tweet.Votes['Count'] != tweet.Plurality['Count'];
            tweet.Uncertainty_Disagreement = (tweet.Votes['Count'] != tweet.Votes['Uncertainty'].length) && tweet.Votes['Uncertainty'].length > 0;
            
            // Find disagreement
            coding.code_list.display.forEach(function(code) {
                var votes     = tweet.Votes['Count'];
                var votes_for, plurality, coder_yes;
                if(code == 'Primary') {
                    votes_for = tweet.Votes[code].filter(function(d) { return d != 'No Code'; }).length;
                    var coder_index = tweet.Votes['Coders'].indexOf(parseInt(coder_id));
                    coder_yes = coder_index > 0 && tweet.Votes[code][coder_index] != 'No Code';
                    plurality = tweet.Plurality[code] != 'No Code' && votes_for > 0;
                } else {
                    votes_for = tweet.Votes[code].length;
                    coder_yes = tweet.Votes[code].includes(parseInt(coder_id));
                    plurality = tweet.Plurality[code] && votes_for > 0;
                }
                var unanimous = votes_for == votes && votes_for > 0;
                var any       = votes_for > 0;
                    
                var entry = code_agreement[code];
                entry['Count']++;
                entry['All']++;
                entry['Average']       += votes_for / votes;
                entry['Unanimous']     += unanimous               ? 1 : 0;
                entry['NotUnanimous']  += !unanimous && any       ? 1 : 0;
                entry['Plurality']     += plurality               ? 1 : 0;
                entry['JustPlurality'] += plurality && !unanimous ? 1 : 0,
                entry['Any']           += any                     ? 1 : 0;
                entry['Minority']      += any       && !plurality ? 1 : 0;
                entry['JustCoder']     += !unanimous && coder_yes && any ? 1 : 0;
                entry['JustOther']     += !unanimous && !coder_yes && any ? 1 : 0;
            })
            
            // Record the confusion between coders and between codes
            tweet.Votes.Coders.map(function(coder1, ic1) {
                var uncertainty1 = tweet.Votes['Uncertainty'].includes(coder1);
                var primary1 = tweet.Votes['Primary'][ic1];
                if(tweet.Plurality['Uncertainty'] && uncertainty1)
                    coding.coders_x_majority_uncertainty[coder1 - 1]++;
                if(tweet.Plurality['Primary'] == primary1)
                    coding.coders_x_majority_primary[coder1 - 1]++;
                
                var primary_icoder = coding.code_list.primary.indexOf(primary1);
                var primary_iplur = coding.code_list.primary.indexOf(tweet.Plurality['Primary']);
                if(primary_icoder >= 0 && primary_iplur >= 0)
                    coding.codes_x_codes[primary_icoder][primary_iplur]++;
                       
                tweet.Votes.Coders.map(function(coder2, ic2) {
                    var primary2 = tweet.Votes['Primary'][ic2];
                    coding.coders_x_coders_possible[coder1 - 1][coder2 - 1]++;
                    if(primary1 == primary2 && primary1 != 'No Code')
                        coding.coders_x_coders_primary[coder1 - 1][coder2 - 1]++;
                    
                    var uncertainty2 = tweet.Votes['Uncertainty'].includes(coder2);
                    if(uncertainty2)// || uncertainty2)
                        coding.coders_x_coders_uncertainty_first[coder1 - 1][coder2 - 1]++ // any
                    if(uncertainty1 && uncertainty2)
                        coding.coders_x_coders_uncertainty_both[coder1 - 1][coder2 - 1]++ // all
                })
            })
        });
        coding.n.codes_per_tweet = coding.n.codes / coding.n.tweets;
        
        // Order coders by how well they did
        if(coder_id == 'all') {
            var coder_agrees = coding.coders_x_coders_primary.map(function(d) { return d3.sum(d); });
            var coder_tweets = coding.coders_x_coders_possible.map(function(d) { return d3.sum(d); });
            var coder_agree_perc = coder_agrees.map(function(d, i) { return d / (coder_tweets[i] || 1); });
            
            // Get the list of available coders, ones that coded any tweets
            var coders_available = d3.range(1, coding.n.coders + 1).filter(function(i) { return coder_tweets[i - 1] > 0; });
            
            // Order that list if necessary
            if(options['Matrices']['Order'].is('alpha')) {
                coders_available.sort(function(a, b) {
                    var name1 = coding.coders[a - 1].Name;
                    var name2 = coding.coders[b - 1].Name;
                    if(name1 > name2) return 1;
                    if(name1 < name2) return -1;
                    return 0;
                });
            } else if (options['Matrices']['Order'].is('cluster')) {
                var distance = coders_available.map(function(i) {
                    return coders_available.map(function(j) {
                        return (coding.coders_x_coders_primary[i-1][j-1] / coding.coders_x_coders_possible[i-1][j-1]) || 1000;
                    });
                });
//                    
//                var distance = coding.coders_x_coders_primary
                var SVD = numeric.svd(distance);
//                var first_component = SVD.V.map(function(d) { return d[coding.nnn]; });
                
//                console.log(SVD.S[coding.nnn]);
//                console.log(SVD.U[coding.nnn], d3.sum(SVD.U[coding.nnn]));
//                console.log(SVD.V[coding.nnn], d3.sum(SVD.V[coding.nnn]));
                var first_component = util.zeros(coding.n.coders + 1);
                SVD.V.forEach(function(d, i) { first_component[coders_available[i] - 1] = d[coding.nnn]; });
                
                coders_available.sort(function(a, b) { 
                    return first_component[b - 1] - first_component[a - 1];
                });
            } else if (options['Matrices']['Order'].is('agreement')) {
                coders_available.sort(function(a, b) { 
                    return coder_agree_perc[b - 1] - coder_agree_perc[a - 1];
                })
            } // Otherwise anonymous, will do it in numeric order
            coders_available.unshift(0); // Add All option
            
            // Update the dropdown
            options['Reliability']['Coder'].available = coders_available;
            if(options['Reliability']['Coder'].available.includes(options['Reliability']['Coder'].indexCur())) {
                options['Reliability']['Coder'].default = options['Reliability']['Coder'].indexCur();
            } else {
                options['Reliability']['Coder'].default = options['Reliability']['Coder'].available[0];
            }
            options.buildSidebarOption('Reliability', 'Coder');
        }

        // Krippendorff's Alpha
        // http://repository.upenn.edu/cgi/viewcontent.cgi?article=1043&context=asc_papers
        codes_tweets_votes = coding.code_list.display.map(function(code) {
            if(code == 'Primary') {
                return coding.tweets_arr.map(function(tweet) {
                    var arr = [0, 0, 0, 0, 0];
                    tweet.Votes.Primary.forEach(function(vote) {
                        var codei = coding.code_list.primary.indexOf(vote);
                        if(codei >= 0)
                            arr[codei]++;
                    });
                    return arr;
                })
            } else {
                return coding.tweets_arr.map(function(tweet) {
                    var arr = [tweet.Votes['Count'] - tweet.Votes[code].length, tweet.Votes[code].length];
                    return arr;
                })
            }   
        });
        coding.code_list.display.forEach(function(code, j) {
            var n_vals = code == 'Primary' ? 5 : 2;
            var total_votes = d3.range(n_vals)
                                .map(function () { return 0; });
            var D_o = d3.sum(codes_tweets_votes[j], function(votes) {
                votes.map(function(count, c) {
                    total_votes[c] += count;
                })
                var multiplier = 1 / (d3.sum(votes) - 1);
                multiplier = multiplier == Infinity ? 0 : multiplier;
                var item_disagree = d3.sum(d3.range(n_vals), function(c) {
                    return d3.sum(d3.range(c + 1, n_vals), function(k) {
                        return (votes[c] * votes[k]) || 0; 
                        // * distance, which is 0 for nominal
                    }) || 0;
                }) || 0;
                return multiplier * item_disagree;
            });
            // really it's just code['Disagreed'];
            var D_e = d3.sum(d3.range(n_vals), function(c) {
                return d3.sum(d3.range(c + 1, n_vals), function(k) {
                    return (total_votes[c] * total_votes[k]) || 0; 
                    // * distance, which is 0 for nominal
                }) || 0;
            });
            
            var n_votes = d3.sum(total_votes);
            var krippendorff_alpha = 1 - (n_votes - 1) * D_o / D_e;
//            console.log(code + ' Krippendorff\'s Alpha = ' + 
//                        '1 - (' + n_votes + ' - 1) * ' + 
//                        D_o + ' / ' + D_e + ' = ' + 
//                        krippendorff_alpha.toFixed(2));
            code_agreement[code]["Alpha"] = krippendorff_alpha;
            
            var agreement = 0;
            if(krippendorff_alpha > 0.8) {
                agreement = 5;
            } else if(krippendorff_alpha > 0.6) {
                agreement = 4;
            } else if(krippendorff_alpha > 0.4) {
                agreement = 3;
            } else if(krippendorff_alpha > 0.2) {
                agreement = 2;
            } else if(krippendorff_alpha > 0) {
                agreement = 1;
            }
            code_agreement[code]["Agreement Level"] = agreement;
        });
        
        // Display data
        coding.code_agreement_arr = code_agreement_arr;
        coding.IRRTable();
        coding.fillMatrices();
        coding.fillTweetList();
        if(options['Tweet Types']['More Information'].is('true')) {
            coding.getMoreInformation();
        }
    },
    IRRTable: function() {
        coding.togglePane('Reliability');
        
        var coder_id = options['Reliability']['Coder'].get();
        
        var results_div = d3.select("#lReliability_body");
        results_div.selectAll("*").remove();
        
        var agreement_table = results_div.append("table")
            .attr('id', 'agreement_table')
            .attr('class', 'table');
        
        var columns = ['Code',
           'Average Chose<br /><small>(% of All)</small>',
           'Majority Chose<br /><small>(% of All)</small>', 
            (coding.n.codes_per_tweet > 2.5 ? 'Minority Chose' : 'Disagreed') + '<br /><small>(% of All)</small>', 
           'Unanimous<br /><small>(% of Any Positive)</small>'];
        if(coder_id != 'all') {
            var coder_name = coding.coders[parseInt(coder_id) - 1].ShortName;
            columns.push(coder_name + ' Chose<br /><small>(% of Any Positive)</small>');
            columns.push('Other Chose<br /><small>(% of Any Positive)</small>');
        } else {
            if(coding.n.codes_per_tweet > 2.5) {
                columns.push('Majority (not all) Chose<br /><small>(% of Any Positive)</small>');
                columns.push('Minority Chose<br /><small>(% of Any Positive)</small>');
            } else {
                columns.push('Disagreed<br /><small>(% of Any Positive)</small>');
            }
        }
        columns.push('Krippendorff\'s &alpha;<br /><small>(Agreement)</small>');
        
        agreement_table.append('thead')
            .append('tr')
            .selectAll('th')
            .data(columns)
            .enter()
            .append('th')
            .html(function(d) { return d; })
            .style('width', (100 / columns.length) + '%');
        
        var rows = agreement_table.append('tbody')
            .selectAll('tr')
            .data(coding.code_agreement_arr)
            .enter()
            .append('tr');
        
        rows.append('td')
            .html(function(d) {
                if(d.Main)
                    return '<b>' + d.Code + '</b>';
                else
                    return '&nbsp;&nbsp;&nbsp;&nbsp;' + d.Code;
            });
        
        var cols = [{ value: 'Average', of: 'All' },
                    { value: 'Plurality', of: 'All' },
                    { value: coding.n.codes_per_tweet > 2.5 ? 'Minority' : 'NotUnanimous',
                      of: 'All' },
                    { value: 'Unanimous', of: 'Any' }];
        if(coder_id != 'all') {
            cols.push({ value: 'JustCoder', of: 'Any' });
            cols.push({ value: 'JustOther', of: 'Any' });
        } else {
            if(coding.n.codes_per_tweet > 2.5) {
                cols.push({ value: 'JustPlurality', of: 'Any' });
            }
            cols.push({
                value: coding.n.codes_per_tweet > 2.5 ? 'Minority' : 'NotUnanimous',
                of: 'Any' });
        }
        
        // Append the columns
        cols.forEach(function(col) {
            rows.append('td')
                .html(function(d) {
                    return d[col.value].toFixed(0) + " <small>(" + 
                        (d[col.value] / d[col.of] * 100).toFixed(0) + 
                        "%)</small>";
                })
                .attr('class', 'table_stat')
                .append('div')
                .style({
                    width: function(d) { 
                        return (d[col.value] / d[col.of] * 90) + '%'},
                    background: col.of == 'Any' ? '#ddd': null
                })
                .attr('class', 'table_bar');
        });
        
        var agreements = ['Poor', 'Slight', 'Fair', 'Moderate', 'Substantial', 'Perfect'];
        var agreement_colors = ['black', '#d62728', '#ff7f0e', '#bcbd22', '#2ca02c', '#1f77b4']; // '#17becf'
        rows.append('td')
            .html(function(d) {
                var agreement = agreements[d['Agreement Level']];
            
                return d['Alpha'].toFixed(2) + 
                    " <small>(" + agreement + ")</small>";
            })
            .attr('class', 'table_stat')
            .append('div')
            .style({
                width: function(d) { 
                    return (d['Alpha'] * 90) + '%'},
                background: function(d) { 
                    return agreement_colors[d['Agreement Level']]}
            })
            .attr('class', 'table_bar');
    },
    fillMatrices: function() {
        coding.togglePane('Matrices');
        
        var div = d3.select('#lMatrices_body')
            .attr('class', 'row');
        div.selectAll('*').remove();
        
        var color_domain = [0, 50, 75, 90, 100];
        var color_range = ["#000000", "#ff9896", "#dbdb8d", "#98df8a", "#aec7e8"];
        var color = d3.scale.linear()
            .domain(color_domain)
            .range(color_range);
//            .range(["black", "red", "yellow", "green", "blue"]);
        
        // Get short coder names
        var coder_names = options['Reliability']['Coder'].labels.map(function(name, i) {
            if(i == 0) return '';
            if(options['Matrices']['Order'].is("anonymous"))
                return i + " ";
            
            return name.split(' ').map(function(name_part) {
                return name_part[0];
            }).join('');
        });
        
        /* Primary coder matrix */
        var matrix = options['Reliability']['Coder'].available.map(function (i) {
            var row = options['Reliability']['Coder'].available.map(function (j) {
                if(i == 0) {
                    return { 
                        FullName: options['Reliability']['Coder'].labels[j],
                        label: coder_names[j] 
                    };
                }
                if(j == 0) {
                    return { 
                        FullName: options['Reliability']['Coder'].labels[i],
                        label: coder_names[i] 
                    };
                }
                var entry = {
                    Agreed: coding.coders_x_coders_primary[i - 1][j - 1],
                    Tweets: coding.coders_x_coders_possible[i - 1][j - 1]
                }
                if(entry['Tweets'] == 0){
                    entry['label'] = '-';
                } else if(i == j){
                    entry['label'] = '-';
                } else {
                    var percent = entry['Agreed'] / entry['Tweets'] * 100;
                    entry['Percent'] = Math.floor(percent * 10) / 10 + '%';
                    entry['label'] = Math.floor(percent) + '';
                }
                return entry;
            });
            if(i == 0) {
                row.push({FullName: 'Combined', label: '&sum;'});
            } else {
                var entry = {
                    Agreed: d3.sum(coding.coders_x_coders_primary[i - 1], function(val, j) { return j != i - 1 ? val : 0 }),
                    Tweets: d3.sum(coding.coders_x_coders_possible[i - 1], function(val, j) { return j != i - 1 ? val : 0 })
                }
                if(entry['Tweets'] == 0){
                    entry['label'] = '';
                } else {
                    var percent = entry['Agreed'] / entry['Tweets'] * 100;
                    entry['Percent'] = Math.round(percent, -1) + '%';
                    entry['label'] = Math.floor(percent) + '';
                }
                row.push(entry);
            }
            return row;
        });
        
        // Make Table
        var table_div = div.append('div')
            .attr('class', 'col-sm-4');
        
        table_div.html('Coder Agreement on Primary Codes<br>')
            .append('small')
            .html("Color Scale: ")
            .selectAll('span')
            .data(d3.range(5))
            .enter()
            .append('span')
            .text(function(d) { return color_domain[d]; })
            .style({
                'background-color': function(d) { return color_range[d]; },
                'padding': '0px 5px',
                'margin': '0px 5px'
            });
            
        table_div.append('table')
            .selectAll('tr')
            .data(matrix)
            .enter()
            .append('tr')
            .selectAll('td')
            .data(function(d) { return d; })
            .enter()
            .append('td')
            .html(function(d) { return d.label; })
            .style('background-color', function(d) {
                if('Percent' in d) return color(d.label);
                if('-' == d.label) return '#CCC';
                return 'white';
            })
            .on('mouseover', function(d) {
                var info = JSON.parse(JSON.stringify(d));
                delete info['label'];
                coding.tooltip.setData(info);
                coding.tooltip.on();
            })
            .on('mousemove', function(d) {
                coding.tooltip.move(d3.event.x, d3.event.y);
            })
            .on('mouseout', function(d) {
                coding.tooltip.off();
            });
        
        /* Uncertainty coder matrix */
        matrix = options['Reliability']['Coder'].available.map(function (i) {
            var row = options['Reliability']['Coder'].available.map(function (j) {
                if(i == 0) {
                    return { 
                        FullName: options['Reliability']['Coder'].labels[j],
                        label: coder_names[j] 
                    };
                }
                if(j == 0) {
                    return { 
                        FullName: options['Reliability']['Coder'].labels[i],
                        label: coder_names[i] 
                    };
                }
                var entry = {
                    Agreed: coding.coders_x_coders_uncertainty_both[i - 1][j - 1],
                    Tweets: coding.coders_x_coders_uncertainty_first[i - 1][j - 1]
                }
                if(entry['Tweets'] == 0){
                    entry['label'] = '-';
                } else if(i == j){
                    entry['label'] = '-';
                } else {
                    var percent = entry['Agreed'] / entry['Tweets'] * 100;
                    entry['Percent'] = Math.floor(percent * 10) / 10 + '%';
                    entry['label'] = Math.floor(percent) + '';
                }
                return entry;
            });
            if(i == 0) {
                row.push({FullName: 'Combined', label: '&sum;'});
            } else {
                var entry = {
                    Agreed: d3.sum(coding.coders_x_coders_uncertainty_both[i - 1], function(val, j) { return j != i - 1 ? val : 0 }),
                    Tweets: d3.sum(coding.coders_x_coders_uncertainty_first[i - 1], function(val, j) { return j != i - 1 ? val : 0 })
                }
                if(entry['Tweets'] == 0){
                    entry['label'] = '';
                } else {
                    var percent = entry['Agreed'] / entry['Tweets'] * 100;
                    entry['Percent'] = Math.round(percent, -1) + '%';
                    entry['label'] = Math.floor(percent) + '';
                }
                row.push(entry);
            }
            return row;
        });
        
        // Make Table
        
        var uncertainty_div = div.append('div')
            .html('Coder Agreement on Uncertainty Codes<br ><small>When at least one Uncertainty code, same color scale</small>')
            .attr('class', 'col-sm-4')
            .append('div')
            .attr('class', 'matrix-table-div');
        
        uncertainty_div.append('span')
            .html('Coder coded uncertain<br />');
        
        uncertainty_div.append('span')
            .text('Other coder agreed')
            .attr('class', 'ylabel');
        
        uncertainty_div.append('table')
            .selectAll('tr')
            .data(matrix)
            .enter()
            .append('tr')
            .selectAll('td')
            .data(function(d) { return d; })
            .enter()
            .append('td')
            .html(function(d) { return d.label; })
            .style('background-color', function(d) {
                if('Percent' in d) return color(d.label);
                if('-' == d.label) return '#CCC';
                return 'white';
            })
            .on('mouseover', function(d) {
                var info = JSON.parse(JSON.stringify(d));
                delete info['label'];
                coding.tooltip.setData(info);
                coding.tooltip.on();
            })
            .on('mousemove', function(d) {
                coding.tooltip.move(d3.event.x, d3.event.y);
            })
            .on('mouseout', function(d) {
                coding.tooltip.off();
            });
        
        
        /* Code matrix */
        var code_names = ['', 'Unc', 'Unr', 'Aff', 'Den', 'Neu', '&sum;'];
        matrix = code_names.map(function (row_name, i) {
            var row = code_names.map(function (col_name, j) {
                if(i == 0) return {val: col_name, max: -1};
                if(j == 0) return {val: row_name, max: -1};
                if(i == 6 && j == 6) return {val: d3.sum(coding.codes_x_codes, function(d) { return d3.sum(d); }), max: -1};
                if(i == 6) return {val: d3.sum(coding.codes_x_codes, function(d) { return d[j - 1];}), max: -1};
                if(j == 6) return {val: d3.sum(coding.codes_x_codes[i - 1]), max: -1};
                
                return {
                    val: coding.codes_x_codes[i - 1][j - 1],
                    max: (coding.codes_x_codes[i - 1][i - 1] + coding.codes_x_codes[j - 1][j - 1]) / 2
                };
            });
            return row;
        });
        
        // Make Table
//        var color2 = d3.scale.log()
//            .domain([1, 10, 100, 1000, 10000])
//            .range(["#000000", "#ff9896", "#dbdb8d", "#98df8a", "#aec7e8"]);
        var color2 = d3.scale.log()
            .domain([1, 3, 10, 30, 100]) //[0, 25, 50, 75, 100]
            .range(["#000000", "#ff9896", "#dbdb8d", "#98df8a", "#aec7e8"]);
        var code_x_code_div = div.append('div')
            .html('Code Confusion<br /><small>How many times a coder disagreed with the majority code</small>')
            .attr('class', 'col-sm-4')
            .append('div')
            .style('text-align', 'center')
            .style('display', 'inline-block');
        
        code_x_code_div.append('span')
            .html('Majority Choose<br />');
        
        var codes_div_inner = code_x_code_div.append('div')
            .attr('class', 'matrix-table-div');
        
        codes_div_inner.append('span')
            .attr('class', 'ylabel')
            .text('Coders Choose')
        
        codes_div_inner.append('table')
            .attr('id', 'codes_confusion_matrix')
            .selectAll('tr')
            .data(matrix)
            .enter()
            .append('tr')
            .selectAll('td')
            .data(function(d) { return d; })
            .enter()
            .append('td')
            .html(function(d) { return d.val; });
//            .style('background-color', function(d) {
//                if(d.max < 0) return 'white';
//                return color2(d.val / d.max * 100);
//            });
    },
    fillTweetList: function() {
        coding.togglePane('Tweets');
        
        var coder_id = options['Reliability']['Coder'].get();
        coder_id = parseInt(coder_id) || 'all';
        var coder = {};
        if(coder_id != 'all') {
            coder = coding.coders[coder_id - 1];
        }
        var tweets_coded = options['Tweets']['Code'].get();
        var tweets_focus = options['Tweets']['Focus'].get();
        var tweets = coding.tweets_arr;
        var period = options['Dataset']['Period'].get();
        
        // Filter out tweets by coder
        if(coder_id != 'all') {
            tweets = tweets.filter(function(tweet) {
                return tweet.Votes.Coders.includes(coder_id);
            });
        } else { // Clone the array
            tweets = tweets.map(function(tweet) { return tweet; });
        }
        
        // Filter out tweets by code & focus
        if(tweets_coded != 'Any') {
            var codes = [tweets_coded];
            if(tweets_coded == 'Related')
                    codes = ['Affirm', 'Deny', 'Neutral'];
            if(tweets_coded == 'Primary')
                    codes = ['Uncodable', 'Unrelated', 'Affirm', 'Deny', 'Neutral'];
            tweets = tweets.filter(function(tweet) {
                return codes.reduce(function(found, code) {
                    if(tweets_focus == 'All'){
                        found |= tweet.Votes[code].length > 0;
                    } else if (tweets_focus == 'Majority') {
                        found |= tweet.Plurality[code];
                    } else if (tweets_focus == 'Disagreement') {
                        found |= (tweet.Votes[code].length > 0 && tweet.Votes[code].length < tweet.Votes['Count']);
                    }
                    if(coder_id != 'all')
                        found |= tweet.Votes[code].includes(coder_id);
                    return found;
                }, false);
            });
        }
        
        // Order the tweets
        if(options['Tweets']['Order'].is('text')) {
            tweets.sort(function(a, b) {
                if(a.Text > b.Text) return 1;
                if(a.Text < b.Text) return -1;
                return 0;
            });
        } else if(options['Tweets']['Order'].is('majority')) {
            tweets.sort(function(a, b) {
                if(a.Plurality['Primary'] == b.Plurality['Primary']) return a.Plurality['Count'] - b.Plurality['Count'];
                if(a.Plurality['Primary'] > b.Plurality['Primary']) return 1;
                if(a.Plurality['Primary'] < b.Plurality['Primary']) return -1;
                return 0;
            });
        } else if(options['Tweets']['Order'].is('disagreement')) {
            tweets.sort(function(a, b) {
                return a.Plurality['Count'] - b.Plurality['Count'];
            });
        } else {
            tweets.sort(function(a, b) {
                return a.Tweet_ID - b.Tweet_ID;
            });
        }
        
        // Add the table
        d3.select('#tweet_table').remove();
        var table = d3.select('#lTweets_body')
            .append('table')
            .attr('id', 'tweet_table')
            .attr('class', 'table table-hover');
        
        table.append('thead')
            .append('tr')
            .selectAll('th')
            .data(['Tweet ID',
                   'Text',
                   coder_id == 'all' ? (coding.n.codes_per_tweet > 2.5 ? 'Majority' : 'Coder 1') : coder.ShortName + "'s Label",
                   coder_id == 'all' ? (coding.n.codes_per_tweet > 2.5 ? 'Minority' : 'Coder 2') : "Other's Label"])
            .enter()
            .append('th')
            .html(function(d) { return d; })
            .attr('class', function(d) {
                return "tweet_table_" + d.split(' ')[0];
            });
        
        
        var rows = table.append('tbody')
            .selectAll('tr')
            .data(tweets)
            .enter()
            .append('tr');
        
        rows.append('td')
            .html(function(d) { return d.Tweet_ID; });
        rows.append('td')
            .html(function(d) { return d.Text; });
        
        rows.append('td')
            .html(function(d) {
                var text = '';
                if(coder_id == 'all') {
                    if(coding.n.codes_per_tweet > 2.5) {
                        coding.code_list.primary6.forEach(function(code) {
                            var n_votes_for = d.Votes[code].length;
                            if (n_votes_for > d.Votes['Count'] / 2 || d.Plurality['Primary'] == code) {
                                text += "<span class='code_Primary code_" + code + "'>" + code;
                                if(coding.n.codes_per_tweet > 2.5) text += ' (' + n_votes_for + ')';
                                text += '</span><br />';
                            }
                        });
                        var num_uncertain = d['Votes']['Uncertainty'].length;
                        if(num_uncertain > d.Votes['Count'] / 2) {
                            text += "<span class='code_Uncertainty'>Uncertainty";
                            if(coding.n.codes_per_tweet > 2.5) text += ' (' + num_uncertain + ')';
                            text += '</span>';
                        }
                    } else {
                        var code = d.Votes['Primary'][0];
                        text += "<span class='code_Primary code_" + d.Votes['Primary'][0] + "'>" + d.Votes['Primary'][0] + "</span>";
                        text += "<br />";
                        var uncertainty = d.Votes['Uncertainty'].includes(d.Votes['Coders'][0]);
                        text += "<span class='code_Uncertainty'>" + (uncertainty ? 'Uncertainty' : '-') + "</span>";
                    }
                } else {
                    coding.code_list.primary6.forEach(function(code) {
                        if (d.Votes[code].includes(coder_id)) {
                            text += "<span class='code_Primary code_" + code + "'>" + code + "</span><br \>";
                        }
                    });
                    if(d.Votes['Uncertainty'].includes(coder_id)) {
                        text += "<span class='code_Uncertainty'>Uncertainty</span>"
                    }
                }
            
                return text;
            })
            .on('mouseover', coding.tweetTooltip)
            .on('mousemove', function(d) {
                coding.tooltip.move(d3.event.x, d3.event.y);
            })
            .on('mouseout', function(d) {
                coding.tooltip.off();
            });
        rows.append('td')
            .html(function(d) {
                var text = '';
                if(coder_id == 'all') {
                    if(coding.n.codes_per_tweet > 2.5) {
                        coding.code_list.primary6.forEach(function(code) {
                            var n_votes_for = d.Votes[code].length;
                            if (n_votes_for <= d.Votes['Count'] / 2 && n_votes_for > 0 && d.Plurality['Primary'] != code) {
                                text += "<span class='code_Primary code_" + code + "'>" + code;
                                if(coding.n.codes_per_tweet > 2.5) text += ' (' + n_votes_for + ')';
                                text += '</span><br />';
                            }
                        });

                        var num_uncertain = d['Votes']['Uncertainty'].length;
                        if(num_uncertain > 0 && num_uncertain <= d.Votes['Count'] / 2) {
                            text += "<span class='code_Uncertainty'>Uncertainty";
                            if(coding.n.codes_per_tweet > 2.5) text += ' (' + num_uncertain + ')';
                            text += '</span>';
                        }
                    } else {
                        var code = d.Votes['Primary'][1];
                        text += "<span class='code_Primary code_" + d.Votes['Primary'][1] + "'>" + d.Votes['Primary'][1] + "</span>";
                        text += "<br />";
                        var uncertainty = d.Votes['Uncertainty'].includes(d.Votes['Coders'][1]);
                        text += "<span class='code_Uncertainty'>" + (uncertainty ? 'Uncertainty' : '-') + "</span>";
                    }
                } else {
                    coding.code_list.primary6.forEach(function(code) {
                        var n_votes_for = d.Votes[code].length - (d.Votes[code].includes(coder_id) ? 1 : 0);
                        if (n_votes_for > 0) {
                            text += "<span class='code_Primary code_" + code + "'>" + code;
                            if(coding.n.codes_per_tweet > 2.5 || n_votes_for > 1) text += ' (' + n_votes_for + ')';
                            text += '</span><br />';
                        }
                    });
                    var num_uncertain = d['Votes']['Uncertainty'].length - (d.Votes['Uncertainty'].includes(coder_id) ? 1 : 0);
                    if(num_uncertain > 0) {
                        text += "<span class='code_Uncertainty'>Uncertainty";
                        if(coding.n.codes_per_tweet > 2.5 || num_uncertain > 1) text += ' (' + num_uncertain + ')';
                        text += '</span><br />';
                    }
                }
            
                return text;
            })
            .on('mouseover', coding.tweetTooltip)
            .on('mousemove', function(d) {
                coding.tooltip.move(d3.event.x, d3.event.y);
            })
            .on('mouseout', function(d) {
                coding.tooltip.off();
            });
        
        
        // ["All", "Majority", "Disagreement", "Primary Disagreement", "Uncertainty Disagreement"],
        if(tweets_focus == 'Disagreement') {
            d3.selectAll('span.code_Uncertainty')
                .classed('small', true);
        } else if(tweets_focus != 'All') {
            if(tweets_focus != 'Primary') {
                d3.selectAll('span.code_' + tweets_focus)
                    .style('font-weight', 'bold');
            }
            
            if(tweets_focus == 'Uncertainty') {
                d3.selectAll('span.code_Primary')
                    .classed('small', true);
            } else {
                d3.selectAll('span.code_Uncertainty')
                    .classed('small', true);
            }
        } else {
            d3.selectAll('span.code_Uncertainty')
                .classed('small', true);
        }
    },
    tweetTooltip: function(d) {
        var voters = d.Votes['Coders'];
        var votes = {};
        voters.forEach(function(voter) { votes[voter] = ''; });
        
        coding.code_list.any.forEach(function(code) {
            d.Votes[code].forEach(function(voter) {
                votes[voter] += code + ' ';
            });
        });
        
        if(!options['Matrices']['Order'].is('anonymous')) {
            var votes2 = {};
            voters.forEach(function(voter) {
                var name = coding.coders[voter - 1].ShortName;
                votes2[name] = votes[voter];
            })
            votes = votes2;
        }
        
        coding.tooltip.setData(votes);
        coding.tooltip.on();
    },
    togglePane: function(pane, duration) {
        if(options[pane].Show.is("true")) {
            d3.select('#' + util.simplify(pane))
                .transition(duration || 10)
                .style({
                    opacity: 1,
                    transform: 'scaleY(1)',
                    display: 'block'
                });
        } else {
            d3.select('#' + util.simplify(pane))
                .transition(duration || 10)
                .style('opacity', 0)
                .style('transform', 'scaleY(0)')
                .each('end', function() {
                    d3.select(this).style('display', 'none')
                });
        }
    },
    getMoreInformation: function() {
        var post = {
            rumor_id: options['Dataset']['Rumor'].get(),
            period: options['Dataset']['Period'].get()
        };
        
        // Wait otherwise some page elements may be stuck
        setTimeout(function() {
            
             data.callPHP('coding/getTweets', post, coding.parseTweetInformation);
        }, 1000);
       
    },
    parseTweetInformation: function(file_data) {
        var tweetsDB;
        try {
            tweetsDB = JSON.parse(file_data);
        } catch(err) {
            console.log(file_data);
            return;
        }
        
        // Add information to the tweets
        tweetsDB.forEach(function(tweetDB) {
            var tweet = coding.tweets[tweetDB.ID];
            if(tweet) {
                tweet.Type = tweetDB.Type;
                tweet.ExpandedURL = tweetDB.ExpandedURL;
            } else {
//                console.log('Somethings wrong mapping tweets, couldn\'t find ID ' + tweetDB.ID);
            }
        });
        
        coding.tweetTypeTable();
        if(!options['N-Grams']['Subset'].is('All'))
            coding.countNGrams(options['N-Grams']['Subset'].get());
        coding.countNGrams('All');
    },
    tweetTypeTable: function() {
        coding.togglePane('Tweet Types');
        
        var rows = ['Uncodable', 'Unrelated', 'Affirm', 'Deny', 'Neutral', 'Uncertainty', 'Total'];
        var columns = ['Original', 'Retweet', 'Reply', 'Quote', 'Unknown', 'Total'];
        
        coding.code_type_counts = rows.map(function(row) {
            return columns.map(function(col) {
                return {
                    Code: row,
                    Type: col,
                    Value: 0,
                    Of: 0
                }
            })
        })
        
        coding.tweets_arr.forEach(function(tweet) {
            var type = tweet.Type || 'Unknown';
            if(type.charAt(0) >= 'a') type = type.charAt(0).toUpperCase() + type.substring(1);
            var i_type = columns.indexOf(type);
            coding.code_type_counts[6][i_type]['Value'] += 1; // total
            
            coding.code_list.binary.forEach(function(code, i_code) {
                var votes     = tweet.Votes['Count'];
                var votes_for = tweet.Votes[code].length;
                coding.code_type_counts[i_code][i_type]['Value'] += votes_for / votes;
                coding.code_type_counts[i_code][5]['Value'] += votes_for / votes; // total
            });
        });
        
        // Add totals
        var denom = options['Tweet Types']['Bars'].get();
        coding.code_type_counts[6][5].Value = d3.sum(coding.code_type_counts[6], function(d) { return d.Value; });
        coding.code_type_counts.forEach(function(row, i_code) {
            row.forEach(function(cell, i_type) {
                cell['Of'] = coding.code_type_counts[denom == 'code' ? i_code : 6][denom == 'tweet_type' ? i_type : 5].Value;
            });
        });
        
        // Format area
        var div = d3.select("#lTweet_Types_body");
        div.selectAll("*").remove();
        
        div.append('span')
            .text('Computed using the Average tweet assignment for each tweet in lieu of adjudicated data.');
        
        var table = div.append("table")
            .attr('id', 'agreement_table')
            .attr('class', 'table');
        
        var colors = d3.scale.category10()
            .domain(denom == 'tweet_type' ? columns : rows);
        
        var column_names = columns.map(function(col) { return col ; });
        column_names.unshift('Code');
        
        table.append('thead')
            .append('tr')
            .selectAll('th')
            .data(column_names)
            .enter()
            .append('th')
            .html(function(d) { return d; })
            .style('width', (100 / column_names.length) + '%');
        
        var table_rows = cells = table.append('tbody')
            .selectAll('tr')
            .data(coding.code_type_counts)
            .enter()
            .append('tr');
        
        table_rows.append('td')
            .html(function(d) {
                return d[0].Code;
            })
        
        table_rows.selectAll('td.table_stat')
            .data(function(d) { return d; })
            .enter()
            .append('td')
            .html(function(d) {
                var main_text = d.Value.toFixed(0);
                var sub_text = denom == 'none' ? '' :
                    ' <small>(' + (d.Value / d.Of * 100).toFixed(0) + '%)</small>';
                return main_text + sub_text;
            })
            .attr('class', 'table_stat')
            .append('div')
            .style({
                width: function(d) { return (denom == 'none' ? 0 : d.Value / d.Of * 90) + '%'},
                background: function(d) { 
                    if(denom == 'all') return null
                    var color = d3.hsl(colors(denom == 'tweet_type' ? d.Type : d.Code));
                    color.s *= .85;
                    color.l *= 1.5;
                    return color; 
                }
            })
            .attr('class', 'table_bar');
        
    },
    countNGrams: function(subset) {
        if(subset.includes('Doc')) {
//            options['N-Grams']['Document'].updateInInterface(options['Dataset']['Rumor'].indexCur());
        }
        subset = subset || options['N-Grams']['Subset'].get();
        
        // Make structures
        coding.ngrams[subset] = {};
        var ngrams = coding.ngrams[subset];
        
        ngrams.nTweets = 0;
        ngrams.CoOccurs = 0
        ngrams.TweetCounter = new Counter();
        ngrams.URLCounter = new Counter();
        ngrams.CoOccurCounter = new Counter();
        ngrams.nGrams = d3.range(3).map(function(d) {
            return 0;
        });
        ngrams.NGramCounter = d3.range(3).map(function(d) {
            return new Counter();
        });
        
        // Document Frequency
//        ngrams.TweetBinaryCounter = new Counter();
//        ngrams.URLBinaCounter = new Counter();
        ngrams.CoOccurHasCounter = new Counter();
        ngrams.NGramHasCounter = d3.range(3).map(function(d) {
            return new Counter();
        });
        
        var tweets = coding.tweets_arr;
        if(subset != 'All') {
            var codes = [subset.slice(7)];
            if(subset == 'Coded: Related')
                    codes = ['Affirm', 'Deny', 'Neutral'];
//            if(subset == 'Primary')
//                    codes = ['Uncodable', 'Unrelated', 'Affirm', 'Deny', 'Neutral'];
            tweets = tweets.filter(function(tweet) {
                return codes.reduce(function(found, code) {
                    return found || tweet.Plurality[code];
                }, false);
            });
        }
        
        // Add up ngrams
        var redundantTweetsOK = options['N-Grams']['Filter'].is('none');
        tweets.forEach(function(tweet) {
            tweet.TextNoURL = tweet.Text.replace(/http\S+/g, ' ');

            ngrams.nTweets += 1;
            
            var newTweet = !ngrams.TweetCounter.has(tweet.TextNoURL);
            var newURL = !ngrams.URLCounter.has(tweet.ExpandedURL);
            
            ngrams.TweetCounter.incr(tweet.TextNoURL);
            ngrams.URLCounter.incr(tweet.ExpandedURL);

            if(newTweet || newURL || redundantTweetsOK) { // Aggressive redundancy check
                var text = tweet.TextNoURL.toLowerCase();
                text = text.replace(/[^\w']+/g, ' ');
                text = text.replace(/(\w)' /g, '$1 ').replace(/ '(\w)/g, ' $1');
                var words = text.split(' ');
                var tweetgrams = [new Set(), new Set(), new Set(), new Set()];

                words.forEach(function(word, wi) {
                    if(word) {
                        var gram = word;
                        ngrams.NGramCounter[0].incr(gram);
                        if(!tweetgrams[0].has(gram)) {
                            tweetgrams[0].add(gram);
                            ngrams.nGrams[0] += 1;
                            ngrams.NGramHasCounter[0].incr(gram);
                        }
                        if(words[wi + 1]) {
                            gram += " " + words[wi + 1];
                            ngrams.NGramCounter[1].incr(gram);
                            if(!tweetgrams[1].has(gram)) {
                                tweetgrams[1].add(gram);
                                ngrams.nGrams[1] += 1;
                                ngrams.NGramHasCounter[1].incr(gram);
                            }
                            if(words[wi + 2]) {
                                gram += " " + words[wi + 2];
                                ngrams.NGramCounter[2].incr(gram);
                                if(!tweetgrams[2].has(gram)) {
                                    tweetgrams[2].add(gram);
                                    ngrams.nGrams[2] += 1;
                                    ngrams.NGramHasCounter[2].incr(gram);
                                }
                            }
                        }
                        for(var wj = wi + 1; wj < words.length; wj++) { 
                            gram = word + ' & ' + words[wj];
                            if(words[wj] < word)
                                gram = words[wj] + ' & ' + word;
                            // Add co-occurance
                            if(words[wj]) {
                                ngrams.CoOccurCounter.incr(gram);
                                if(!tweetgrams[3].has(gram)) {
                                    tweetgrams[3].add(gram);
                                    ngrams.CoOccurs += 1;
                                    ngrams.CoOccurHasCounter.incr(gram);
                                }
                            }
                        }
                    }
                });
            } // New Tweet or New URL
        });
        
        coding.NGramList();
    },
    NGramList: function() {
        coding.togglePane('N-Grams');
        
        var tf_mod = options['N-Grams']['TF Modifier'].get();
        var idf = options['N-Grams']['IDF'].get();
        var tables = options['N-Grams']['Tables'].get();
        var ngrams = coding.ngrams[options['N-Grams']['Subset'].get()];
        var div = d3.select('#lN_Grams_body');
        div.selectAll('*').remove();

        var labels = ['Unigrams', 'Bigrams', 'Trigrams'];
        if(tables.includes('c')) labels.push('Co-Occurance');
        if(tables.includes('t')) labels.push('Tweets');
        if(tables.includes('u')) labels.push('URLs');
        
        var n = parseInt(options['N-Grams']['TopX'].get());
        var has = options['N-Grams']['TF'].is('has') ? 'Has' : '';
        var counters = ngrams['NGram' + has + 'Counter'].map(function(d) { return d; }); 
        if(tables.includes('c')) counters.push(ngrams['CoOccur' + has + 'Counter']);
        if(tables.includes('t')) counters.push(ngrams.TweetCounter);
        if(tables.includes('u')) counters.push(ngrams.URLCounter);
        
        var raw_lists = counters.map(function(counter, i_counter) {
            if(options['N-Grams']['Exclude Stopwords'].is("true") && i_counter < 4) {
                return counter.top_no_stopwords(n);
            } else {
                return counter.top(n);
            }
        });
        
        // Add more fields
        var ngrams_document, counter_document;
        if(!options['N-Grams']['DF'].is('none')) {
            var dhas = options['N-Grams']['DF'].is('has') ? 'Has' : '';
            ngrams_document = coding.ngrams.All; // change this for rumors
            counters_document = ngrams_document['NGram' + dhas + 'Counter'].map(function(d) { return d; }); 
            if(tables.includes('c')) counters_document.push(ngrams_document['CoOccur' + dhas + 'Counter']);
            if(tables.includes('t')) counters_document.push(ngrams_document.TweetCounter);
            if(tables.includes('u')) counters_document.push(ngrams_document.URLCounter);
        }
        var quantity = ngrams_document == undefined ? 'Term Frequency' : 'TF-IDF';

        var lists = raw_lists.map(function(list, ilist) {
            list = list.map(function(entry) {
                var newEntry = { Term: entry.key };
                if(tf_mod != 'raw') {
                    newEntry['Raw Count'] = entry.value;
                    newEntry['Term Frequency'] = tf_mod == 'log' ? 1 + Math.log(entry.value) :
                                             tf_mod == 'percent' ? entry.value / ngrams.nTweets * 100 :
                                            tf_mod == 'fraction' ? (entry.value / ngrams.nTweets || 0) : 0;
                } else {
                    newEntry['Term Frequency'] = entry.value;
                }
                if(ngrams_document) {
                    newEntry['Document Frequency'] = counters_document[ilist].has(entry.key) || 0;
                    newEntry['IDF'] = options['N-Grams']['IDF'].is('inv') ? 1 / newEntry['Document Frequency'] :
                                      options['N-Grams']['IDF'].is('ratio') ? ngrams_document.nTweets / newEntry['Document Frequency'] :
                                      Math.log(ngrams_document.nTweets / newEntry['Document Frequency']);
                    newEntry['TF-IDF'] = newEntry['Term Frequency'] * newEntry['IDF'];
                }
                return newEntry;
            });
            
            // Sory by the value we care about
            list.sort(function(a, b) { return b[quantity] - a[quantity]; });
            
            // Convert values to strings with appropriate decimals
            list.forEach(function(entry) {
                Object.keys(entry).forEach(function(key) {
                    if(Math.floor(entry[key]) == entry[key]) {
                        // nothing
                    } else if(entry[key] < 10) {
                        entry[key] = entry[key].toFixed(2)
                    } else if(entry[key] < 100) {
                        entry[key] = entry[key].toFixed(1)
                    }
//                    if(key.includes('log') ['Fraction', 'Log TF', 'IDF', 'Log IDF'].includes(key)) {
//                        entry[key] = entry[key].toFixed(2)
//                    } else if(['Percent', 'TF-IDF'].includes(key)) {
//                        entry[key] = entry[key].toFixed(1)
//                    }
                }) 
            })
            
            return list;
        });
        
        div.append('table')
            .style('width', '100%')
            .append('tr')
            .selectAll('td')
            .data(lists)
            .enter()
            .append('td')
            .attr('class', 'ngram_table_container')
            .style('width', 100 / labels.length + '%')
            .append('table')
            .attr('class', 'ngram_table')
            .each(function(d, i) {
                var header = d3.select(this).append('tr');
                header.append('th')
                    .attr('class', 'ngram_count_label')
                    .text(labels[i]);
                header.append('th')
                    .attr('class', 'ngram_count_count')
                    .text(idf.includes('idf') ? 'TF-IDF' : 'Freq');

                d3.select(this)
                    .selectAll('tr.ngram_count')
                    .data(d)
                    .enter()
                    .append('tr')
                    .attr('class', 'ngram_count');
            });
        
        div.selectAll('.ngram_count')
            .append('td')
            .attr('class', 'ngram_count_label')
            .text(function(d) { return d['Term']; });
        
        
        div.selectAll('.ngram_count')
            .append('td')
            .attr('class', 'ngram_count_count')
            .text(function(d) { 
                return d[quantity];
            });
        div.selectAll('td.ngram_count_label, td.ngram_count_count')
            .on('mouseover', function(d) {
                coding.tooltip.setData(d);
                coding.tooltip.on();
            })
            .on('mousemove', function() {
                coding.tooltip.move(d3.event.x, d3.event.y);
            })
            .on('mouseout', function() {
                coding.tooltip.off();
            });
    }
};

function initialize() {
    coding = new Coding();
    options = new Options();
    data = new Data();
    
    coding.buildPage();
}
window.onload = initialize;