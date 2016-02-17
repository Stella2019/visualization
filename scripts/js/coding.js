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
    this.tooltip.init();
    
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
    getData: function() {
        var progress = 0;
        
        data.callPHP('coding/getCoders', {}, function(d) {
            coding.coders = JSON.parse(d);
            progress++
            if(progress == 4)
                coding.buildDropdowns();
        });
            
        data.callPHP('collection/getEvents', {}, function(d) {
            coding.events = JSON.parse(d);
            progress++
            if(progress == 4)
                coding.buildDropdowns();
        });

        data.callPHP('collection/getRumors', {}, function(d) {
            coding.rumors = JSON.parse(d);
            progress++
            if(progress == 4)
                coding.buildDropdowns();
        });

        // Get the number of codes for each rumor
        data.callPHP('coding/rumorPeriodCounts', {}, function(d) {
            coding.rumor_period_counts = JSON.parse(d);
            progress++
            if(progress == 4)
                coding.buildDropdowns();
        });
    },
    buildDropdowns: function() {
        // Rumors
        coding.rumors.sort(function(a, b) {
            if(a.Event_ID == b.Event_ID) {
                if(a.Name > b.Name) return 1;
                if(a.Name < b.Name) return -1;
                return 0;
            }
            return parseInt(a.Event_ID) - parseInt(b.Event_ID);
        })
        var labels = coding.rumors.map(function(rumor) {
            rumor.event = coding.events.filter(function(event){
                return event.ID == rumor.Event_ID;
            })[0];
            return rumor.event.DisplayName + ": " + rumor.Name;
        });
        var ids = coding.rumors.map(function(rumor) {
            return rumor.ID;
        });
        var available = [];
        coding.rumors.forEach(function(rumor, i_r) {
            rumor.periods = [];
            coding.rumor_period_counts.forEach(function(count) {
                if(count.Rumor == rumor.ID)
                    rumor.periods.push(parseInt(count.Period));
            });
            if(rumor.periods.length) {
                available.push(i_r);
            }
        });
        
        options.choice_groups = [];
        options.initial_buttons = ['show_irr', 'rumor', 'period', 'coder',
                                   'show_matrices',  'coder_order',
                                   'show_tweets', 'tweets_coded', 'tweets_focus', 'tweet_order',
                                   'show_tweet_types', 'tweet_types_bars',
                                   'show_ngrams', 'ngrams_exclude_stopwords', 'ngrams_counts', 'ngrams_coded'];
        options.record = options.initial_buttons;
        options.rumor = new Option({
            title: 'Rumor',
            labels: labels,
            ids:    ids,
            available: available,
            default: 0,
            type: "dropdown",
            parent: '#irr_header',
            callback: coding.chooseRumor
        });
        
        // Period
        options.period = new Option({
            title: 'Period',
            labels: ['Adjudicated', 'Coding', 'Training 1', 'Training 2', 'Training 3', 'Training 4'],
            ids:    [1, 0, -1, -2, -3, -4],
            isnumeric: true,
            default: 1,
            type: "dropdown",
            parent: '#irr_header',
            callback: coding.getCodes
        });
        
        // Coders
        labels = coding.coders.map(function(coder) {
            return coder.Name;
        });
        labels.unshift('All');
        ids = coding.coders.map(function(coder) {
            return coder.ID;
        });
        ids.unshift('all');
        
        options.coder = new Option({
            title: 'Coder',
            labels: labels,
            ids:    ids,
            isnumeric: true,
            default: 0,
            type: "dropdown",
            parent: '#irr_header',
            callback: coding.compileReport
        });
        
        // Types of disagreement        
        options.tweets_coded = new Option({
            title: 'Coded',
            labels: ['Any',
                     'Primary Code',
                     'Uncodable',
                     'Unrelated',
                     'Related',
                     'Affirm',
                     'Deny',
                     'Neutral',
                     'Uncertainty'],
            ids:    ["Any", "Primary", "Uncodable", "Unrelated", 'Related', "Affirm", "Deny", "Neutral", "Uncertainty"],
            default: 0,
            type: "dropdown",
            parent: '#tweets_header',
            callback: coding.fillTweetList
        });    
        options.tweets_focus = new Option({
            title: 'Focus',
            labels: ['All',
                     'Majority Coded',
                     'Disagreement'],
            ids:    ["All", "Majority", "Disagreement"],
            default: 0,
            type: "dropdown",
            parent: '#tweets_header',
            callback: coding.fillTweetList
        });
        
        // Ordering Data    
        options.coder_order = new Option({
            title: "Order",
            labels: ["Alphabetic", "Agreement", "Anonymous", "Cluster"],
            ids:    ['alpha', 'agreement', 'anonymous', 'cluster'],
            default: 2,
            available: [0, 1, 2],
            parent: '#matrices_header',
            callback: coding.compileReport
        });
        options.tweet_order = new Option({
            title: "Order",
            labels: ['Tweet ID', 'Text', 'Majority Code', 'Disagreement'],
            ids:    ['tweet_id', 'text', 'majority', 'disagreement'],
            default: 3,
            parent: '#tweets_header',
            callback: coding.fillTweetList
        });
        
        // Tweet Types Table
        options.tweet_types_bars = new Option({
            title: "Show Bars For",
            labels: ['% of All', '% within each Tweet Type', '% within each Code', 'None'],
            ids:    ['all', 'tweet_type', 'code', 'none'],
            default: 0,
            parent: '#tweet_types_header',
            callback: coding.tweetTypeTable
        });
        
        // NGram Display
        options.ngrams_exclude_stopwords = new Option({
            title: "Exclude Stopwords",
            styles: ["btn btn-sm btn-default", "btn btn-sm"],
            labels: ["Including Stopwords",
                     "Excluding Stopwords"],
            ids:    ['false', 'true'],
            default: 1,
            type: 'toggle',
            parent: '#ngrams_header',
            callback: coding.NGramList
        });
//        options.ngrams_relative = new Option({
//            title: "Relative",
//            styles: ["btn btn-sm", "btn btn-sm btn-default"],
//            labels: ["Absolute Counts",
//                     "Relative Counts"],
//            ids:    ['false', 'true'],
//            default: 0,
//            type: 'toggle',
//            parent: '#ngrams_header',
//            callback: coding.NGramList
//        });
        options.ngrams_counts = new Option({
            title: "Counts",
            labels: ['Raw', '% of Tweets', 'TF-IDF Rumor'],
            ids:    ['raw', 'nTweets', 'tf-idf'],
            default: 0,
            parent: '#ngrams_header',
            callback: coding.NGramList
        });
        options.ngrams_coded = new Option({
            title: "For Tweets Coded",
            labels: ['Any', 'Uncodable', 'Unrelated', 'Related',
                     'Affirm', 'Deny', 'Neutral',
                     'Uncertainty'],
            ids:    ['Any', 'Uncodable', 'Unrelated', 'Related',
                     'Affirm', 'Deny', 'Neutral', 
                     'Uncertainty'],
            default: 0,
            parent: '#ngrams_header',
            callback: coding.countNGrams
        });
        
        // subsection toggles
        options.show_irr = new Option({
            title: 'Show Interrator Reliability Statistics',
            styles: ["btn btn-sm", "btn btn-sm btn-default"],
            labels: ["<span class='glyphicon glyphicon-menu-up'></span>",
                     "<span class='glyphicon glyphicon-menu-down'></span>"],
            ids:    ["false", "true"],
            default: 1,
            type: "toggle",
            parent: '#irr_header',
            callback: function() { coding.togglePane('irr', 1000); }
        });
        options.show_matrices = new Option({
            title: 'Show Matrices',
            styles: ["btn btn-sm", "btn btn-sm btn-default"],
            labels: ["<span class='glyphicon glyphicon-menu-up'></span>",
                     "<span class='glyphicon glyphicon-menu-down'></span>"],
            ids:    ["false", "true"],
            default: 0,
            type: "toggle",
            parent: '#matrices_header',
            callback: function() { coding.togglePane('matrices', 1000); }
        });
        options.show_tweets = new Option({
            title: 'Show Tweets',
            styles: ["btn btn-sm", "btn btn-sm btn-default"],
            labels: ["<span class='glyphicon glyphicon-menu-up'></span>",
                     "<span class='glyphicon glyphicon-menu-down'></span>"],
            ids:    ["false", "true"],
            default: 0,
            type: "toggle",
            parent: '#tweets_header',
            callback: function() { coding.togglePane('tweets', 1000); }
        });
        options.show_tweet_types = new Option({
            title: 'Show Tweet Types',
            styles: ["btn btn-sm", "btn btn-sm btn-default"],
            labels: ["<span class='glyphicon glyphicon-menu-up'></span>",
                     "<span class='glyphicon glyphicon-menu-down'></span>"],
            ids:    ["false", "true"],
            default: 0,
            type: "toggle",
            parent: '#tweet_types_header',
            callback: function() { coding.togglePane('tweet_types', 1000); }
        });
        options.show_ngrams = new Option({
            title: 'Show N-Grams',
            styles: ["btn btn-sm", "btn btn-sm btn-default"],
            labels: ["<span class='glyphicon glyphicon-menu-up'></span>",
                     "<span class='glyphicon glyphicon-menu-down'></span>"],
            ids:    ["false", "true"],
            default: 0,
            type: "toggle",
            parent: '#ngrams_header',
            callback: function() { coding.togglePane('ngrams', 1000); }
        });
        
        
        // Start drawing
        options.init();
        
        // Change some of the appearances
        d3.selectAll('.choice')
            .style('vertical-align', 'top');
        d3.selectAll('.btn-primary')
            .classed('btn-default', true)
            .classed('btn-primary', false);
        
        coding.chooseRumor();
    },
    chooseRumor: function() {
        coding.rumor = {};
        coding.rumors.forEach(function(rumor) {
            if(options.rumor.is(rumor.ID))
               coding.rumor = rumor;
        });
        
        options.period.available = [];
        options.period.ids.forEach(function(period, i) {
            if(coding.rumor.periods.includes(period))
                options.period.available.push(i);
        });
        if(options.period.available.includes(options.period.indexCur())) {
            options.period.default = options.period.indexCur();
        } else {
            options.period.default = options.period.available[0];
        }
        options.buildDropdown('period');
        options.period.click(options.period.default);
    },
    getCodes: function() {
        var post = {
            rumor_id: options.rumor.get(),
            period: options.period.get()
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
        options.coder.available = available;
        options.buildDropdown('coder');
        
        // Compile the report
        coding.compileReport();
    },
    compileReport: function() {
        
        // Get tweets for this report
        var coder_id = options.coder.get();
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
        coding.coders_x_coders_uncertainty_either = util.zeros(coding.n.coders, coding.n.coders);
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
                    if(uncertainty1 || uncertainty2)
                        coding.coders_x_coders_uncertainty_either[coder1 - 1][coder2 - 1]++ // any
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
            if(options.coder_order.is('alpha')) {
                coders_available.sort(function(a, b) {
                    var name1 = coding.coders[a - 1].Name;
                    var name2 = coding.coders[b - 1].Name;
                    if(name1 > name2) return 1;
                    if(name1 < name2) return -1;
                    return 0;
                });
            } else if (options.coder_order.is('cluster')) {
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
            } else if (options.coder_order.is('agreement')) {
                coders_available.sort(function(a, b) { 
                    return coder_agree_perc[b - 1] - coder_agree_perc[a - 1];
                })
            } // Otherwise anonymous, will do it in numeric order
            coders_available.unshift(0); // Add All option
            
            // Update the dropdown
            options.coder.available = coders_available;
            if(options.coder.available.includes(options.coder.indexCur())) {
                options.coder.default = options.coder.indexCur();
            } else {
                options.coder.default = options.coder.available[0];
            }
            options.buildDropdown('coder');
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
        coding.getMoreInformation();
    },
    IRRTable: function() {
        coding.togglePane('irr');
        
        var coder_id = options.coder.get();
        
        var results_div = d3.select("#irr");
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
        coding.togglePane('matrices');
        
        var div = d3.select('#matrices')
            .attr('class', 'row');
        div.selectAll('*').remove();
        
        var color_domain = [0, 50, 75, 90, 100];
        var color_range = ["#000000", "#ff9896", "#dbdb8d", "#98df8a", "#aec7e8"];
        var color = d3.scale.linear()
            .domain(color_domain)
            .range(color_range);
//            .range(["black", "red", "yellow", "green", "blue"]);
        
        // Get short coder names
        var coder_names = options.coder.labels.map(function(name, i) {
            if(i == 0) return '';
            if(options.coder_order.is("anonymous"))
                return i + " ";
            
            return name.split(' ').map(function(name_part) {
                return name_part[0];
            }).join('');
        });
        
        /* Primary coder matrix */
        var matrix = options.coder.available.map(function (i) {
            var row = options.coder.available.map(function (j) {
                if(i == 0) {
                    return { 
                        FullName: options.coder.labels[j],
                        label: coder_names[j] 
                    };
                }
                if(j == 0) {
                    return { 
                        FullName: options.coder.labels[i],
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
        matrix = options.coder.available.map(function (i) {
            var row = options.coder.available.map(function (j) {
                if(i == 0) {
                    return { 
                        FullName: options.coder.labels[j],
                        label: coder_names[j] 
                    };
                }
                if(j == 0) {
                    return { 
                        FullName: options.coder.labels[i],
                        label: coder_names[i] 
                    };
                }
                var entry = {
                    Agreed: coding.coders_x_coders_uncertainty_both[i - 1][j - 1],
                    Tweets: coding.coders_x_coders_uncertainty_either[i - 1][j - 1]
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
                    Tweets: d3.sum(coding.coders_x_coders_uncertainty_either[i - 1], function(val, j) { return j != i - 1 ? val : 0 })
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
        div.append('div')
            .html('Coder Agreement on Uncertainty Codes<br ><small>When at least one Uncertainty code, same color scale</small>')
            .attr('class', 'col-sm-4')
            .append('table')
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
        
        code_x_code_div.append('span')
            .text('Coders Choose')
            .style({
                float: 'left',
                'text-orientation': 'upright',
                'writing-mode': 'vertical-lr',
                transform: 'translateY(35%)'
            });
        
        code_x_code_div.append('table')
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
        coding.togglePane('tweets');
        
        var coder_id = options.coder.get();
        coder_id = parseInt(coder_id) || 'all';
        var coder = {};
        if(coder_id != 'all') {
            coder = coding.coders[coder_id - 1];
        }
        var tweets_coded = options.tweets_coded.get();
        var tweets_focus = options.tweets_focus.get();
        var tweets = coding.tweets_arr;
        var period = options.period.get();
        
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
        if(options.tweet_order.is('text')) {
            tweets.sort(function(a, b) {
                if(a.Text > b.Text) return 1;
                if(a.Text < b.Text) return -1;
                return 0;
            });
        } else if(options.tweet_order.is('majority')) {
            tweets.sort(function(a, b) {
                if(a.Plurality['Primary'] == b.Plurality['Primary']) return a.Plurality['Count'] - b.Plurality['Count'];
                if(a.Plurality['Primary'] > b.Plurality['Primary']) return 1;
                if(a.Plurality['Primary'] < b.Plurality['Primary']) return -1;
                return 0;
            });
        } else if(options.tweet_order.is('disagreement')) {
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
        var table = d3.select('#tweets')
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
        
        if(!options.coder_order.is('anonymous')) {
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
        if(options['show_' + pane].is("true")) {
            d3.select('#' + pane)
                .transition(duration || 10)
                .style('opacity', 1)
                .style('transform', 'scaleY(1)')
                .style('transform-origin', 'top')
                .style('display', 'block');
        
        } else {
            d3.select('#' + pane)
                .transition(duration || 10)
                .style('opacity', 0)
                .style('transform', 'scaleY(0)')
                .style('transform-origin', 'top')
                .each('end', function() {
                    d3.select(this).style('display', 'none')
                });
        }
    },
    getMoreInformation: function() {
        var post = {
            rumor_id: options.rumor.get(),
            period: options.period.get()
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
        if(!options.ngrams_coded.is('Any'))
            coding.countNGrams(options.ngrams_coded.get());
        coding.countNGrams('Any');
    },
    tweetTypeTable: function() {
        coding.togglePane('tweet_types');
        
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
        var denom = options.tweet_types_bars.get();
        coding.code_type_counts[6][5].Value = d3.sum(coding.code_type_counts[6], function(d) { return d.Value; });
        coding.code_type_counts.forEach(function(row, i_code) {
            row.forEach(function(cell, i_type) {
                cell['Of'] = coding.code_type_counts[denom == 'code' ? i_code : 6][denom == 'tweet_type' ? i_type : 5].Value;
            });
        });
        
        // Format area
        var results_div = d3.select("#tweet_types");
        results_div.selectAll("*").remove();
        
        results_div.append('span')
            .text('Computed using the Average tweet assignment for each tweet in lieu of adjudicated data.');
        
        var table = results_div.append("table")
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
        subset = subset || options.ngrams_coded.get();
        
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
        
        var tweets = coding.tweets_arr;
        if(subset != 'Any') {
            var codes = [subset];
            if(subset == 'Related')
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
        tweets.forEach(function(tweet) {
            tweet.TextNoURL = tweet.Text.replace(/http\S+/g, ' ');

            ngrams.nTweets += 1;
            
            var newTweet = ngrams.TweetCounter.has(tweet.TextNoURL);
            var newURL = ngrams.URLCounter.has(tweet.ExpandedURL);
            
            ngrams.TweetCounter.incr(tweet.TextNoURL);
            ngrams.URLCounter.incr(tweet.ExpandedURL);

            
            if(newTweet || newURL) {
                var text = tweet.TextNoURL.toLowerCase();
                text = text.replace(/[^\w']+/g, ' ');
                text = text.replace(/\w' | '\w/g, ' ');
                var words = text.split(' ');
                var tweetgrams = [new Set(), new Set(), new Set(), new Set()];

                words.forEach(function(word, wi) {
                    if(word) {
                        var gram = word;
                        if(!tweetgrams[0].has(gram)) {
                            tweetgrams[0].add(gram);
                            ngrams.nGrams[0] += 1;
                            ngrams.NGramCounter[0].incr(gram);
                        }
                        if(words[wi + 1]) {
                            gram += " " + words[wi + 1];
                            if(!tweetgrams[1].has(gram)) {
                                tweetgrams[1].add(gram);
                                ngrams.nGrams[1] += 1;
                                ngrams.NGramCounter[1].incr(gram);
                            }
                            if(words[wi + 2]) {
                                gram += " " + words[wi + 2];
                                if(!tweetgrams[2].has(gram)) {
                                    tweetgrams[2].add(gram);
                                    ngrams.nGrams[2] += 1;
                                    ngrams.NGramCounter[2].incr(gram);
                                }
                            }
                        }
                        for(var wj = wi + 1; wj < words.length; wj++) { 
                            gram = word + ' & ' + words[wj];
                            if(words[wj] < word)
                                gram = words[wj] + ' & ' + word;
                            // Add co-occurance
                            if(!tweetgrams[3].has(gram) && words[wj]) {
                                tweetgrams[3].add(gram);
                                ngrams.CoOccurs += 1;
                                ngrams.CoOccurCounter.incr(gram);
                            }
                            
                        }
                    }
                });
            } // New Tweet or New URL
        });
        
        coding.NGramList();
    },
    NGramList: function() {
        coding.togglePane('ngrams');
        
        var counts = options.ngrams_counts.get();
        var ngrams = coding.ngrams[options.ngrams_coded.get()];
        var div = d3.select('#ngrams');
        div.selectAll('*').remove();

        var labels = ['Unigrams', 'Bigrams', 'Trigrams', 'Co-Occurance', 'URLs'];
        var top;
        if(options.ngrams_exclude_stopwords.is("true")) {
            top = [ngrams.NGramCounter[0].top_no_stopwords(100),
                   ngrams.NGramCounter[1].top_no_stopwords(100),
                   ngrams.NGramCounter[2].top_no_stopwords(100),
                   ngrams.CoOccurCounter.top_no_stopwords(100),
                   ngrams.URLCounter.top(100)];
        } else {
            top = [ngrams.NGramCounter[0].top(100),
                   ngrams.NGramCounter[1].top(100),
                   ngrams.NGramCounter[2].top(100),
                   ngrams.CoOccurCounter.top(100),
                   ngrams.URLCounter.top(100)];
        }

        if(counts == 'tf-idf' && coding.ngrams.Any) {
            var ngrams_all = coding.ngrams.Any;
            top[0].forEach(function(entry) {
                entry['# for all in Rumor'] = ngrams_all.NGramCounter[0].has(entry.key);
                entry['TF-IDF Rumor'] = entry.value * Math.log(ngrams_all.nTweets / entry['# for all in Rumor']);
            });
            top[1].forEach(function(entry) {
                entry['# for all in Rumor'] = ngrams_all.NGramCounter[1].has(entry.key);
                entry['TF-IDF Rumor'] = entry.value * Math.log(ngrams_all.nTweets / entry['# for all in Rumor']);
            });
            top[2].forEach(function(entry) {
                entry['# for all in Rumor'] = ngrams_all.NGramCounter[2].has(entry.key);
                entry['TF-IDF Rumor'] = entry.value * Math.log(ngrams_all.nTweets / entry['# for all in Rumor']);
            });            
            top[3].forEach(function(entry) {
                entry['# for all in Rumor'] = ngrams_all.CoOccurCounter.has(entry.key);
                entry['TF-IDF Rumor'] = entry.value * Math.log(ngrams_all.nTweets / entry['# for all in Rumor']);
            });
            top[4].forEach(function(entry) {
                entry['# for all in Rumor'] = ngrams_all.URLCounter.has(entry.key);
                entry['TF-IDF Rumor'] = entry.value * Math.log(ngrams_all.nTweets / entry['# for all in Rumor']);
            });
            
            top[0].sort(function(a, b) { return b.value - a.value; });
            top[1].sort(function(a, b) { return b.value - a.value; });
            top[2].sort(function(a, b) { return b.value - a.value; });
            top[3].sort(function(a, b) { return b.value - a.value; });
            top[4].sort(function(a, b) { return b.value - a.value; });
        }
//        var relative = options.ngrams_relative.is("true");

        div.append('table')
            .append('tr')
            .selectAll('td')
            .data(top)
            .enter()
            .append('td')
            .attr('class', 'ngram_table_container')
            .style('width', '20%')
            .append('table')
            .attr('class', 'ngram_table')
            .each(function(d, i) {
                var header = d3.select(this).append('tr');
                header.append('th')
                    .attr('class', 'ngram_count_label')
                    .text(labels[i]);
                header.append('th')
                    .attr('class', 'ngram_count_count')
                    .text(counts == 'tf-idf' ? 'TF-IDF' : counts == 'nTweets' ? 'Freq' : 'Count');

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
            .text(function(d) { return d.key; });
        
        if(counts == 'nTweets') {
            div.selectAll('.ngram_count')
                .append('td')
                .attr('class', 'ngram_count_count')
                .text(function(d) { 
                    return (d.value * 100.0 / ngrams.nTweets).toFixed(1); 
            });
        } else if (counts == 'tf-idf') {
            div.selectAll('.ngram_count')
                .append('td')
                .attr('class', 'ngram_count_count')
                .text(function(d) { 
                    return d['TF-IDF Rumor'].toFixed(1); 
            });
        } else {
            div.selectAll('.ngram_count')
                .append('td')
                .attr('class', 'ngram_count_count')
                .text(function(d) { return d.value; });
        }
        div.selectAll('.ngram_count_count')
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
    
    coding.getData();
}
window.onload = initialize;