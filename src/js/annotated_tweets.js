// Coding refers to the coding group, annotating tweets
function Coding() {
    // Packages
    this.connection = new Connection();
    this.ops = new Options(this);
    this.dataset = new CollectionManager(this, {name: 'dataset', flag_sidebar: false});
    this.tooltip = new Tooltip();
    this.modal = new Modal();
    
    this.events = [];
    this.rumors = [];
    this.rumor = {};
    this.coders = [];
    this.raw_codes = {};
    
    this.rumor_period_counts = {};
    
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
}
Coding.prototype = {
    init: function() {
        this.setTriggers();
        this.tooltip.init();
        
        triggers.emit('build_page');
        triggers.emit('overview_data: get');
    },
    buildPage: function() {
        
        this.ops.panels = ['Dataset', 'Reliability', 'Matrices', 'Tweets', 'Tweet Types'];
        
        var divs = d3.select('body')
            .append('div')
            .attr('id', 'body')
            .attr('class', 'container')
            .selectAll('div')
            .data(this.ops.panels.slice(1))
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
        
    },
    setTriggers: function() {
        // Debugging
//        triggers.verbose = true;
        
        // Page management
        triggers.on('build_page', this.buildPage.bind(this));
        triggers.on('toggle_pane', this.togglePane.bind(this));
        
        // Initial Data
        triggers.on('overview_data: get', this.getOverviewData.bind(this));
        triggers.on('overview_data: collected', this.checkOverviewData.bind(this));
        triggers.on('build_options', this.buildOptions.bind(this));
        triggers.on('rumor: choose', this.chooseRumor.bind(this));
        
        // Codes
        triggers.on('codes: parse', this.parseCodes.bind(this));
        triggers.on('codes: compile', this.compileReport.bind(this));
        triggers.on('codes: processed', this.IRRTable.bind(this));
        triggers.on('codes: processed', this.fillMatrices.bind(this));
        
        // Tweet Details: text, type, distinct, url
        triggers.on('tweet details: get', this.getTweetDetails.bind(this));
        triggers.on('tweet details: parse', this.parseTweetDetails.bind(this));
        triggers.on('tweet details: processed', this.fillTweetList.bind(this));
        triggers.on('tweet details: processed', this.tweetTypeTable.bind(this));
    },
    getOverviewData: function() {
        this.connection.phpjson('coding/getCoders', {}, function(d) {
            this.coders = d;
            triggers.emit('overview_data: collected');
        }.bind(this));
            
        this.connection.phpjson('collection/getEvent', {}, function(d) {
            this.events = d;
            triggers.emit('overview_data: collected');
        }.bind(this));

        this.connection.phpjson('collection/getRumor', {}, function(d) {
            this.rumors = d;
            triggers.emit('overview_data: collected');
        }.bind(this));

        // Get the number of codes for each rumor
        this.connection.phpjson('coding/rumorPeriodCounts', {}, function(d) {
            this.rumor_period_counts = d;
            triggers.emit('overview_data: collected');
        }.bind(this));
    },
    checkOverviewData: function() {
        if(this.coders.length > 0 && 
           this.events.length > 0 && 
           this.rumors.length > 0 && 
           Object.keys(this.rumor_period_counts).length > 0) {
            // Sort Rumors
            this.rumors.sort(function(a, b) {
                if(a.Event == b.Event) {
                    if(a.Name > b.Name) return 1;
                    if(a.Name < b.Name) return -1;
                    return 0;
                }
                return parseInt(a.Event) - parseInt(b.Event);
            });
            
            triggers.emit('build_options');
        }
    },
    buildOptions: function() {
        // Get Rumor Data
        var rumor_labels = this.rumors.map(function(rumor) {
            rumor.event = this.events.filter(function(event){
                return event.ID == rumor.Event;
            })[0];
            return rumor.event.DisplayName + ": " + rumor.Name;
        }, this);
        var rumor_ids = this.rumors.map(x => x.ID);
        var rumor_available = [];

        this.rumors.forEach(function(rumor, i_r) {
            rumor.periods = [];
            this.rumor_period_counts.forEach(function(count) {
                if(count.Rumor == rumor.ID)
                    rumor.periods.push(parseInt(count.Period));
            });
            if(rumor.periods.length) {
                rumor_available.push(i_r);
            }
        }, this);
        
        // Get Coder Data
        var coder_labels = this.coders.map(x => x.Name);
        coder_labels.unshift('All');
        var coder_ids = this.coders.map(function(coder) {
            return coder.ID;
        });
        coder_ids.unshift('all');
        
        // Make Panel Options
        this.ops['Dataset'] = {
            Rumor: new Option({
                title: 'Rumor',
                labels: rumor_labels,
                ids:    rumor_ids,
                available: rumor_available,
                type: "dropdown",
                callback: triggers.emitter('rumor: choose')
            }),
            Period: new Option({
                title: 'Period',
                labels: ['Final', 'Auxiliary Coding 3', 'Auxiliary Coding 2', 'Auxiliary Coding 1', 'Adjudicated', 'Coding', 'Training 1', 'Training 2', 'Training 3', 'Training 4'],
                ids:    [5, 4, 3, 2, 1, 0, -1, -2, -3, -4],
                isnumeric: true,
                default: 1,
                type: "dropdown",
                callback: this.getCodes.bind(this)
            })
        };
        this.ops['Reliability'] = {
            Show: new Option({
                title: 'Show',
                styles: ["btn btn-sm", "btn btn-sm btn-default"],
                labels: ["No", "Yes"],
                ids:    ["false", "true"],
                default: 1,
                type: "toggle",
                callback: triggers.emitter('toggle_pane', ['Reliablity', 1000])
            }),
            Coder: new Option({
                title: 'Coder',
                labels: coder_labels,
                ids:    coder_ids,
                isnumeric: true,
                type: "dropdown",
                callback: this.compileReport.bind(this)
            })
        };
        this.ops['Matrices'] = {
            Show: new Option({
                title: 'Show',
                styles: ["btn btn-sm", "btn btn-sm btn-default"],
                labels: ["No", "Yes"],
                ids:    ["false", "true"],
                type: "toggle",
                callback: triggers.emitter('toggle_pane', ['Matrices', 1000])
            }),
            Order: new Option({
                title: "Order",
                labels: ["Alphabetic", "Agreement", "Anonymous", "Cluster"],
                ids:    ['alpha', 'agreement', 'anonymous', 'cluster'],
                default: 2,
                available: [0, 1, 2],
                parent: '#matrices_header',
                callback: this.compileReport.bind(this)
            })
        };
        
        var tweet_codes = ["Any", "Primary", "Uncodable", "Unrelated", 'Related', "Affirm", "Deny", "Neutral", "Uncertainty"];
        this.ops['Tweets'] = {
            Show: new Option({
                title: 'Show',
                styles: ["btn btn-sm", "btn btn-sm btn-default"],
                labels: ["No", "Yes"],
                ids:    ["false", "true"],
                type: "toggle",
                callback: triggers.emitter('toggle_pane', ['Tweets', 1000])
            }),
            Code: new Option({
                title: 'Code',
                labels: tweet_codes,
                ids:    tweet_codes,
                type: "dropdown",
                callback: this.fillTweetList.bind(this)
            }),
            Focus: new Option({
                title: 'Focus',
                labels: ['All', 'Majority Coded', 'Disagreement'],
                ids:    ["All", "Majority", "Disagreement"],
                type: "dropdown",
                callback: this.fillTweetList.bind(this)
            }),
            Order: new Option({
                title: "Order",
                labels: ['Tweet ID', 'Text', 'Majority Code', 'Disagreement'],
                ids:    ['tweet_id', 'text', 'majority', 'disagreement'],
                default: 3,
                callback: this.fillTweetList.bind(this)
            })
        };
        this.ops['Tweet Types'] = {
            Show: new Option({
                title: 'Show',
                styles: ["btn btn-sm", "btn btn-sm btn-default"],
                labels: ["No", "Yes"],
                ids:    ["false", "true"],
                type: "toggle",
                callback: triggers.emitter('toggle_pane', ['Tweet Types', 1000])
            }),
            'Tweet Details': new Option({
                title: 'Get Tweet Details (Takes Time)',
                labels: ['Yes', 'No'], ids: ['true', 'false'],
                type: 'dropdown',
                hidden: true,
                callback: triggers.emitter('tweet details: get')
            }),
            Bars: new Option({
                title: "Show Bars For",
                labels: ['% of All', '% within each Tweet Type', '% within each Code', 'None'],
                ids:    ['all', 'tweet_type', 'code', 'none'],
                callback: this.tweetTypeTable.bind(this)
            })
        };
        var subsets = tweet_codes.map(x => 'Coded: ' + x);
        subsets[0] = 'All';
        
        // Start drawing
        this.ops.init();
        
        triggers.emit('rumor: choose');
    },
    chooseRumor: function() {
        this.rumor = {};
        this.rumors.forEach(function(rumor) {
            if(this.ops['Dataset']['Rumor'].is(rumor.ID))
               this.rumor = rumor;
        }, this);
        
        // Set document counter
        /*this.ops['N-Grams']['Document'].updateInInterface(this.ops['Dataset']['Rumor'].indexCur());*/
        
        // Set period
        var period_option = this.ops['Dataset']['Period'];
        period_option.available = [];
        period_option.ids.forEach(function(period, i) {
            if(this.rumor.periods.includes(period))
                period_option.available.push(i);
        }, this);
        if(period_option.available.includes(period_option.indexCur())) {
            period_option.default = period_option.indexCur();
        } else {
            period_option.default = period_option.available[0];
        }
        this.ops.buildSidebarOption('Dataset', 'Period');
        period_option.click(period_option.default);
    },
    getCodes: function() {
        var post = {
            rumor_id: this.ops['Dataset']['Rumor'].get(),
            period: this.ops['Dataset']['Period'].get()
        };

        this.connection.phpjson('coding/get', post, triggers.emitter('codes: parse'));
    },
    parseCodes: function(json_data) {
        this.raw_codes = json_data;
        
        // Only enable the coders that coded for the rumor
        var unique_coders = this.raw_codes.reduce(function(set, code) {
            set.add(code['Coder']);
            return set;
        }, new Set());
        unique_coders.add('0'); // All 0 for all
        var available = Array.from(unique_coders).map(function(coder_id) {
            return parseInt(coder_id);
        });
        available.sort(function(a, b) { return a - b; });
        this.ops['Reliability']['Coder'].available = available;
        this.ops.buildSidebarOption('Reliability', 'Coder');
        
        // Compile the report
        triggers.emit('codes: compile');
    },
    compileReport: function() {        
        // Get tweets for this report
        var coder_id = this.ops['Reliability']['Coder'].get();
        this.tweets = {};
        this.tweets_arr = [];
        this.raw_codes.forEach(function(code) {
            if(!(code.Tweet in this.tweets) && 
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
                this.tweets[code.Tweet] = newTweet;
                this.tweets_arr.push(newTweet);
            }
        }, this);
        
        // Add votes for each to the tweets
        this.raw_codes.forEach(function(code) {
            if(code.Tweet in this.tweets) {
                tweet = this.tweets[code.Tweet];
                tweet.Votes.Coders.push(parseInt(code.Coder));
                tweet.Votes.Count++;
                tweet.Votes.Primary.push(code.Primary);
                if(code.Primary == 'No Code')
                    tweet.Votes['No Code'].push(parseInt(code.Coder));
                
                this.code_list.any.forEach(function(c) {
                    if(code[c] == '1') {
                        tweet.Votes[c].push(parseInt(code.Coder));
                    }
                });
            }
        }, this);
        
        // Initialize objects
        this.n.codes = 0;
        this.n.tweets = this.tweets_arr.length
761;
        this.n.coders = this.coders.length;
        this.coders_x_coders_possible = util.zeros(this.n.coders, this.n.coders);
        this.coders_x_coders_primary = util.zeros(this.n.coders, this.n.coders);
        this.coders_x_majority_primary = util.zeros(this.n.coders, 1);
        this.coders_x_majority_uncertainty = util.zeros(this.n.coders, 1);
        this.coders_x_coders_uncertainty_first = util.zeros(this.n.coders, this.n.coders);
        this.coders_x_coders_uncertainty_both = util.zeros(this.n.coders, this.n.coders);
        this.codes_x_codes = util.zeros(this.n.primary, this.n.primary);
        
        var code_agreement = {};
        var code_agreement_arr = [];
        this.code_list.display.forEach(function(code) {
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
        this.tweets_arr.forEach(function(tweet) {                        
            // Get the plurality
            this.n.codes += tweet.Votes['Count'];
            tweet.Plurality['Count'] = d3.max(this.code_list.primary6, function(code) { return tweet.Votes[code].length; });
            this.code_list.primary6.forEach(function(code) {
                tweet.Plurality[code] = tweet.Votes[code].length == tweet.Plurality['Count'];
                if(!tweet.Plurality['Primary'] && tweet.Plurality[code])
                    tweet.Plurality['Primary'] = code;
            })
            tweet.Plurality['Uncertainty'] = tweet.Votes['Uncertainty'].length / tweet.Votes['Count'] >= 0.5;
            tweet.Primary_Disagreement     = tweet.Votes['Count'] != tweet.Plurality['Count'];
            tweet.Uncertainty_Disagreement = (tweet.Votes['Count'] != tweet.Votes['Uncertainty'].length) && tweet.Votes['Uncertainty'].length > 0;
            
            // Find disagreement
            this.code_list.display.forEach(function(code) {
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
                    this.coders_x_majority_uncertainty[coder1 - 1]++;
                if(tweet.Plurality['Primary'] == primary1)
                    this.coders_x_majority_primary[coder1 - 1]++;
                
                var primary_icoder = this.code_list.primary.indexOf(primary1);
                var primary_iplur = this.code_list.primary.indexOf(tweet.Plurality['Primary']);
                if(primary_icoder >= 0 && primary_iplur >= 0)
                    this.codes_x_codes[primary_icoder][primary_iplur]++;
                       
                tweet.Votes.Coders.forEach(function(coder2, ic2) {
                    var primary2 = tweet.Votes['Primary'][ic2];
                    this.coders_x_coders_possible[coder1 - 1][coder2 - 1]++;
                    if(primary1 == primary2 && primary1 != 'No Code')
                        this.coders_x_coders_primary[coder1 - 1][coder2 - 1]++;
                    
                    var uncertainty2 = tweet.Votes['Uncertainty'].includes(coder2);
                    if(uncertainty2)// || uncertainty2)
                        this.coders_x_coders_uncertainty_first[coder1 - 1][coder2 - 1]++; // any
                    if(uncertainty1 && uncertainty2) {
                        this.coders_x_coders_uncertainty_both[coder1 - 1][coder2 - 1]++; // all
                        if(coder1 != coder2)
                            this.coders_x_coders_uncertainty_both[coder1 - 1][coder1 - 1]++; // all
                    }
                }, this)
            }, this)
        }, this);
        this.n.codes_per_tweet = this.n.codes / this.n.tweets;
        
        // Order coders by how well they did
        if(coder_id == 'all') {
            var coder_agrees = this.coders_x_coders_primary.map(function(d) { return d3.sum(d); });
            var coder_tweets = this.coders_x_coders_possible.map(function(d) { return d3.sum(d); });
            var coder_agree_perc = coder_agrees.map(function(d, i) { return d / (coder_tweets[i] || 1); });
            
            // Get the list of available coders, ones that coded any tweets
            var coders_available = d3.range(1, this.n.coders + 1).filter(function(i) { return coder_tweets[i - 1] > 0; });
            
            // Order that list if necessary
            if(this.ops['Matrices']['Order'].is('alpha')) {
                coders_available.sort(function(a, b) {
                    var name1 = this.coders[a - 1].Name;
                    var name2 = this.coders[b - 1].Name;
                    if(name1 > name2) return 1;
                    if(name1 < name2) return -1;
                    return 0;
                }.bind(this));
            } else if (this.ops['Matrices']['Order'].is('cluster')) {
                var distance = coders_available.map(function(i) {
                    return coders_available.map(function(j) {
                        return (this.coders_x_coders_primary[i-1][j-1] / this.coders_x_coders_possible[i-1][j-1]) || 1000;
                    }, this);
                }, this);
//                    
//                var distance = this.coders_x_coders_primary
                var SVD = numeric.svd(distance);
//                var first_component = SVD.V.map(function(d) { return d[this.nnn]; });
                
//                console.log(SVD.S[this.nnn]);
//                console.log(SVD.U[this.nnn], d3.sum(SVD.U[this.nnn]));
//                console.log(SVD.V[this.nnn], d3.sum(SVD.V[this.nnn]));
                var first_component = util.zeros(this.n.coders + 1);
                SVD.V.forEach(function(d, i) { first_component[coders_available[i] - 1] = d[this.nnn]; });
                
                coders_available.sort(function(a, b) { 
                    return first_component[b - 1] - first_component[a - 1];
                });
            } else if (this.ops['Matrices']['Order'].is('agreement')) {
                coders_available.sort(function(a, b) { 
                    return coder_agree_perc[b - 1] - coder_agree_perc[a - 1];
                })
            } // Otherwise anonymous, will do it in numeric order
            coders_available.unshift(0); // Add All option
            
            // Update the dropdown
            this.ops['Reliability']['Coder'].available = coders_available;
            if(this.ops['Reliability']['Coder'].available.includes(this.ops['Reliability']['Coder'].indexCur())) {
                this.ops['Reliability']['Coder'].default = this.ops['Reliability']['Coder'].indexCur();
            } else {
                this.ops['Reliability']['Coder'].default = this.ops['Reliability']['Coder'].available[0];
            }
            this.ops.buildSidebarOption('Reliability', 'Coder');
        }

        // Krippendorff's Alpha
        // http://repository.upenn.edu/cgi/viewcontent.cgi?article=1043&context=asc_papers
        codes_tweets_votes = this.code_list.display.map(function(code) {
            if(code == 'Primary') {
                return this.tweets_arr.map(function(tweet) {
                    var arr = [0, 0, 0, 0, 0];
                    tweet.Votes.Primary.forEach(function(vote) {
                        var codei = this.code_list.primary.indexOf(vote);
                        if(codei >= 0)
                            arr[codei]++;
                    }, this);
                    return arr;
                }, this)
            } else {
                return this.tweets_arr.map(function(tweet) {
                    var arr = [tweet.Votes['Count'] - tweet.Votes[code].length, tweet.Votes[code].length];
                    return arr;
                })
            }   
        }, this);
        this.code_list.display.forEach(function(code, j) {
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
        this.code_agreement_arr = code_agreement_arr;
        triggers.emit('codes: processed');
        triggers.emit('tweet details: get');
    },
    IRRTable: function() {
        triggers.emit('toggle_pane', 'Reliability');
        
        var coder_id = this.ops['Reliability']['Coder'].get();
        
        var results_div = d3.select("#lReliability_body");
        results_div.selectAll("*").remove();
        
        var agreement_table = results_div.append("table")
            .attr('id', 'agreement_table')
            .attr('class', 'table');
        
        var columns = ['Code',
           'Average Chose<br /><small>(% of All)</small>',
           'Majority Chose<br /><small>(% of All)</small>', 
            (this.n.codes_per_tweet > 2.5 ? 'Minority Chose' : 'Disagreed') + '<br /><small>(% of All)</small>', 
           'Unanimous<br /><small>(% of Any Positive)</small>'];
        if(coder_id != 'all') {
            var coder_name = this.coders[parseInt(coder_id) - 1].ShortName;
            columns.push(coder_name + ' Chose<br /><small>(% of Any Positive)</small>');
            columns.push('Other Chose<br /><small>(% of Any Positive)</small>');
        } else {
            if(this.n.codes_per_tweet > 2.5) {
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
            .data(this.code_agreement_arr)
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
                    { value: this.n.codes_per_tweet > 2.5 ? 'Minority' : 'NotUnanimous',
                      of: 'All' },
                    { value: 'Unanimous', of: 'Any' }];
        if(coder_id != 'all') {
            cols.push({ value: 'JustCoder', of: 'Any' });
            cols.push({ value: 'JustOther', of: 'Any' });
        } else {
            if(this.n.codes_per_tweet > 2.5) {
                cols.push({ value: 'JustPlurality', of: 'Any' });
            }
            cols.push({
                value: this.n.codes_per_tweet > 2.5 ? 'Minority' : 'NotUnanimous',
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
        triggers.emit('toggle_pane', 'Matrices');
        
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
        var coder_names = this.ops['Reliability']['Coder'].labels.map(function(name, i) {
            if(i == 0) return '';
            if(this.ops['Matrices']['Order'].is("anonymous"))
                return i + " ";
            
            return name.split(' ').map(function(name_part) {
                return name_part[0];
            }).join('');
        }, this);
        
        /* Primary coder matrix */
        var matrix = this.ops['Reliability']['Coder'].available.map(function (i) {
            var row = this.ops['Reliability']['Coder'].available.map(function (j) {
                if(i == 0) {
                    return { 
                        FullName: this.ops['Reliability']['Coder'].labels[j],
                        label: coder_names[j] 
                    };
                }
                if(j == 0) {
                    return { 
                        FullName: this.ops['Reliability']['Coder'].labels[i],
                        label: coder_names[i] 
                    };
                }
                var entry = {
                    Agreed: this.coders_x_coders_primary[i - 1][j - 1],
                    Tweets: this.coders_x_coders_possible[i - 1][j - 1]
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
            }, this);
            if(i == 0) {
                row.push({FullName: 'Combined', label: '&sum;'});
            } else {
                var entry = {
                    Agreed: d3.sum(this.coders_x_coders_primary[i - 1], function(val, j) { return j != i - 1 ? val : 0 }),
                    Tweets: d3.sum(this.coders_x_coders_possible[i - 1], function(val, j) { return j != i - 1 ? val : 0 })
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
        }, this);
        
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
                this.tooltip.setData(info);
                this.tooltip.on();
            }.bind(this))
            .on('mousemove', function(d) {
                this.tooltip.move(d3.event.x, d3.event.y);
            }.bind(this))
            .on('mouseout', function(d) {
                this.tooltip.off();
            }.bind(this));
        
        /* Uncertainty coder matrix */
        this.buildUncertaintyMatrix();
        
        
        /* Code matrix */
        var code_names = ['', 'Unc', 'Unr', 'Aff', 'Den', 'Neu', '&sum;'];
        matrix = code_names.map(function (row_name, i) {
            var row = code_names.map(function (col_name, j) {
                if(i == 0) return {val: col_name, max: -1};
                if(j == 0) return {val: row_name, max: -1};
                if(i == 6 && j == 6) return {val: d3.sum(this.codes_x_codes, function(d) { return d3.sum(d); }), max: -1};
                if(i == 6) return {val: d3.sum(this.codes_x_codes, function(d) { return d[j - 1];}), max: -1};
                if(j == 6) return {val: d3.sum(this.codes_x_codes[i - 1]), max: -1};
                
                return {
                    val: this.codes_x_codes[i - 1][j - 1],
                    max: (this.codes_x_codes[i - 1][i - 1] + this.codes_x_codes[j - 1][j - 1]) / 2
                };
            }, this);
            return row;
        }, this);
        
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
    buildUncertaintyMatrix() {
        // Get parameters
        var coder_names = this.ops['Reliability']['Coder'].labels.map(function(name, i) {
            if(this.ops['Matrices']['Order'].is("anonymous"))
                return i + " ";
            
            return name.split(' ').map(word => word[0]).join('');
        }, this);
        var i_coders = this.ops['Reliability']['Coder'].available.filter(x => x != 0);
        var coder_labels_all = this.ops['Reliability']['Coder'].labels;
        var anon = this.ops['Matrices']['Order'].is("anonymous");
        var n_coders = i_coders.length;
        var n_rows = 1 /* title */
                       + n_coders /* pairwise agreement */
                       + 1 /* overall agreement */;
        var n_cols = 1 /* title */
                       + n_coders /* pairwise agreement */
                       + 1 /* overall agreement */ 
                       + 1 /* blank cell */ 
                       + 3 /* count: personal, others, direction */;
        var u_matrix = util.zeros(n_rows).map(x => util.zeros(n_cols).map(y => {
            return {label: '_', style: 'u_cell_plain', tooltip: {}, color: ''};
        }));
        var div = d3.select('#lMatrices_body')
            .attr('class', 'row');
        var color_domain = [0, 50, 75, 90, 100];
        var color_range = ["#000000", "#ff9896", "#dbdb8d", "#98df8a", "#aec7e8"];
        var color = d3.scale.linear()
            .domain(color_domain)
            .range(color_range);
//            .range(["black", "red", "yellow", "green", "blue"]);
        
        // Add labels
        var coder_labels = i_coders.map(i_coder => { return anon ? i_coder :
                coder_labels_all[i_coder].split(' ').map(word => word[0]).join(''); });
        i_coders.forEach((i_coder, i_row) => {
            var full_name = coder_labels_all[i_coder];
            var label = coder_labels[i_row];
            
            u_matrix[0][i_row + 1].label = label;
            u_matrix[i_row + 1][0].label = label;
            u_matrix[0][i_row + 1].tooltip = {'Full Name': full_name, 'Coder': 'Choose Uncertainty'};
            u_matrix[i_row + 1][0].tooltip = {'Full Name': full_name, 'Coder': 'Agreed with Col'};
        });
        u_matrix[n_coders + 1][0].label = 'B/C';
        u_matrix[n_coders + 1][0].tooltip = {'Both / Coder': ''};
        u_matrix[0][n_coders + 1].label = 'B/O';
        u_matrix[0][n_coders + 1].tooltip = {'Both / Others': ''};
        u_matrix[0][n_coders + 3].label = 'B';
        u_matrix[0][n_coders + 3].tooltip = {'# Pairwise relations when': 'Both Choose'};
        u_matrix[0][n_coders + 4].label = 'C';
        u_matrix[0][n_coders + 4].tooltip = {'# Pairwise relations when': 'Coder Choose'};
        u_matrix[0][n_coders + 5].label = 'O';
        u_matrix[0][n_coders + 5].tooltip = {'# Pairwise relations when': 'Other Choose'};
        
        // Add pairwise agreement
        var pairwise_fracs = [];
        i_coders.forEach((i_coder, i_row) => i_coders.forEach((j_coder, i_col) => {
            var cell = u_matrix[i_row + 1][i_col + 1];
            var agreed = this.coders_x_coders_uncertainty_both[i_coder - 1][j_coder - 1];
            var first_coder = this.coders_x_coders_uncertainty_first[i_coder - 1][j_coder - 1];
            var second_coder = this.coders_x_coders_uncertainty_first[j_coder - 1][i_coder - 1];
            var fraction = i_coder != j_coder ? agreed / first_coder || 0 : 0;
            if(i_coder != j_coder) {
                cell.tooltip[coder_labels[i_col] + ' & ' + coder_labels[i_row] + ' Found Uncertain'] = agreed;
            }
            cell.tooltip[coder_labels[i_col] + ' Found Uncertain'] = first_coder;
            if(i_coder != j_coder) {
                cell.tooltip[coder_labels[i_row] + ' Found Uncertain'] = second_coder;
                cell.tooltip['Percent Agreement with ' + coder_labels[i_col]] = Math.floor(fraction * 1000) / 10 + '%';
                pairwise_fracs.push({f: fraction, cell: cell});
            }
            cell.label = fraction ? Math.floor(fraction * 100) : '-';
//            cell.color = fraction ? color(fraction * 100) : '#CCC';
            cell.style = 'u_cell_pairwise';
        }, this), this);
        
        // Mark notable pairwise 
        var pairwise_low = d3.mean(pairwise_fracs, d => d.f) - Math.sqrt(d3.variance(pairwise_fracs, d => d.f));
        var pairwise_high = d3.mean(pairwise_fracs, d => d.f) + Math.sqrt(d3.variance(pairwise_fracs, d => d.f));
        pairwise_fracs.forEach(function(cell) {
            if(cell.f < pairwise_low)
                cell.cell.style += ' u_cell_toolow';
            else if(cell.f > pairwise_high)
                cell.cell.style += ' u_cell_toohigh'; 
            else if(cell.f < 0.75)
                cell.cell.style += ' u_cell_lt75'; 
            else if(cell.f > 0.90)
                cell.cell.style += ' u_cell_gt90'; 
        });
        
        // Add summary agreement
        var COUNTERNAMES = {count_both: 0, count_self: 1, count_others: 2,
                            frac_both_self: 3, frac_both_other: 4};
        var counters = util.zeros(5).map(i => { return {list: [], low: 0, high: 1}});
        i_coders.forEach((i_coder, i_row) => {
            // This match is ratchet and should be redone for code clarity but it should work
            var self__choose_double = this.coders_x_coders_uncertainty_both[i_coder - 1][i_coder - 1]; // == self + double
            var self__choose = this.coders_x_coders_uncertainty_first[i_coder - 1][i_coder - 1]; // weirdddd loop
            var both__choose = d3.sum(this.coders_x_coders_uncertainty_both[i_coder - 1]) - self__choose_double;            
            var other_choose = d3.sum(this.coders_x_coders_uncertainty_first[i_coder - 1]) - self__choose;      
            var self__choose = d3.sum(this.coders_x_coders_uncertainty_first, d => d[i_coder - 1]) - self__choose;
            var frac_both_coder = both__choose / self__choose;
            var frac_both_other = both__choose / other_choose;
            
            var cell_both_coder = u_matrix[n_coders + 1][i_row + 1];
            cell_both_coder.label = frac_both_coder ? Math.floor(frac_both_coder * 100) : '-';
//            cell_both_coder.color = frac_both_coder ? color(frac_both_coder * 100) : '#CCC';
            cell_both_coder.tooltip[coder_labels[i_row] + ' & Others Found Uncertain'] = both__choose;
            cell_both_coder.tooltip[coder_labels[i_row] + ' Found Uncertain'] = self__choose;
            cell_both_coder.tooltip['Percent ' + coder_labels[i_row] + ' Agreed with Others'] = Math.floor(frac_both_coder * 1000) / 10 + '%'; 
            cell_both_coder.style = 'u_cell_coltotal';
            
            var cell_both_other = u_matrix[i_row + 1][n_coders + 1];   
            cell_both_other.label = frac_both_other ? Math.floor(frac_both_other * 100) : '-';
//            cell_both_other.color = frac_both_other ? color(frac_both_other * 100) : '#CCC';
            cell_both_other.tooltip[coder_labels[i_row] + ' & Others Found Uncertain'] = both__choose;
            cell_both_other.tooltip['Others Found Uncertain'] = other_choose;
            cell_both_other.tooltip['Percent ' + coder_labels[i_row] + ' Agreed with Others'] = Math.floor(frac_both_other * 1000) / 10 + '%';
            cell_both_other.style = 'u_cell_rowtotal';
            
            // Add counts
            u_matrix[i_row + 1][n_coders + 3].label = both__choose;
            u_matrix[i_row + 1][n_coders + 4].label = self__choose;
            u_matrix[i_row + 1][n_coders + 5].label = other_choose;
            
            counters[COUNTERNAMES.count_both].list.push(both__choose);
            counters[COUNTERNAMES.count_self].list.push(self__choose);
            counters[COUNTERNAMES.count_others].list.push(other_choose);
            counters[COUNTERNAMES.frac_both_self].list.push(frac_both_coder);
            counters[COUNTERNAMES.frac_both_other].list.push(frac_both_other);
        }, this);
        
        // Add summaries this math was wrong so I choose to add up from above
//        var one_choose = d3.sum(this.coders_x_coders_uncertainty_first, d => d3.sum(d)) / 2; //433
//        var both_choose = (d3.sum(this.coders_x_coders_uncertainty_both, d => d3.sum(d)) - one_choose) / 2; // 304
        var total_both__choose = d3.sum(counters[COUNTERNAMES.count_both].list);
        var total_self__choose = d3.sum(counters[COUNTERNAMES.count_self].list);
        var total_other_choose = d3.sum(counters[COUNTERNAMES.count_others].list);
        var fraction_both = total_both__choose / total_self__choose;
        
        u_matrix[n_coders + 1][n_coders + 1].label = Math.floor(fraction_both * 100);
        u_matrix[n_coders + 1][n_coders + 1].tooltip['Both Choose'] = total_both__choose;
        u_matrix[n_coders + 1][n_coders + 1].tooltip['One Choose'] = total_self__choose;
        u_matrix[n_coders + 1][n_coders + 1].tooltip['Percent Both'] = Math.floor(fraction_both * 1000) / 10 + '%';
        u_matrix[n_coders + 1][n_coders + 1].style = fraction_both < 0.75 ? 'u_cell_lt75' : 
                                                     fraction_both > 0.90 ? 'u_cell_gt90' : '';
        u_matrix[n_coders + 1][n_coders + 3].label = total_both__choose;
        u_matrix[n_coders + 1][n_coders + 4].label = total_self__choose;
        u_matrix[n_coders + 1][n_coders + 5].label = total_other_choose;
        
        // Add color for high variance
        counters.forEach(counter => {
            counter.low = d3.mean(counter.list) - Math.sqrt(d3.variance(counter.list));
            counter.high = d3.mean(counter.list) + Math.sqrt(d3.variance(counter.list));
        });
        i_coders.forEach(function(i_coder, i_row) {
             counters.forEach((counter, i_measure) => {
                 var cell = i_measure <= COUNTERNAMES.count_others ? 
                     u_matrix[i_row + 1][n_coders + 3 + i_measure] :
                     i_measure == COUNTERNAMES.frac_both_self ?
                     u_matrix[n_coders + 1][i_row + 1] :
                     u_matrix[i_row + 1][n_coders + 1];
                 if(counter.list[i_row] < counter.low)
                     cell.style += ' u_cell_toolow';
                 else if(counter.list[i_row] > counter.high)
                     cell.style += ' u_cell_toohigh';
                 else if(counter.list[i_row] < 0.75 && i_measure > COUNTERNAMES.count_others)
                     cell.style += ' u_cell_lt75';
                 else if(counter.list[i_row] > 0.90 && i_measure > COUNTERNAMES.count_others)
                     cell.style += ' u_cell_gt90';
             });
        });
        
        // Make Table
        var uncertainty_div = div.append('div')
            .attr('class', 'col-sm-4')
            .html('Pairwise Coder Agreement on Uncertainty<br />');
        
        uncertainty_div.append('small')
            .html('Colors: ')
            .selectAll('span')
            .data([{label: 'Lowest', style: 'u_cell_toolow u_cell_colorscale'},
                   {label: '< 75', style: 'u_cell_lt75 u_cell_colorscale'},
                   {label: '> 90', style: 'u_cell_gt90 u_cell_colorscale'},
                   {label: 'Highest', style: 'u_cell_toohigh u_cell_colorscale'}])
            .enter()
            .append('span')
            .text(d => d.label)
            .attr('class', d => d.style);
            
        var matrix_div = uncertainty_div.append('div')
            .attr('class', 'matrix-table-div');
        
        matrix_div.append('span')
            .html('Coder coded uncertain<br />');
        
        matrix_div.append('span')
            .text('Other coder agreed')
            .attr('class', 'ylabel');
        
        matrix_div.append('table')
            .selectAll('tr')
            .data(u_matrix)
            .enter()
            .append('tr')
            .selectAll('td')
            .data(d => d)
            .enter()
            .append('td')
            .html(d => d.label)
            .attr('class', d => 'u_cell ' + d.style)
            .style('background-color', d => d.color);
        this.tooltip.attach('.u_cell', d => d.tooltip);
    },
    fillTweetList: function() {
        triggers.emit('toggle_pane', 'Tweets');
        
        var coder_id = this.ops['Reliability']['Coder'].get();
        coder_id = parseInt(coder_id) || 'all';
        var coder = {};
        if(coder_id != 'all') {
            coder = this.coders[coder_id - 1];
        }
        var tweets_coded = this.ops['Tweets']['Code'].get();
        var tweets_focus = this.ops['Tweets']['Focus'].get();
        var tweets = this.tweets_arr;
        var period = this.ops['Dataset']['Period'].get();
        
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
        if(this.ops['Tweets']['Order'].is('text')) {
            tweets.sort(function(a, b) {
                if(a.Text > b.Text) return 1;
                if(a.Text < b.Text) return -1;
                return 0;
            });
        } else if(this.ops['Tweets']['Order'].is('majority')) {
            tweets.sort(function(a, b) {
                if(a.Plurality['Primary'] == b.Plurality['Primary']) return a.Plurality['Count'] - b.Plurality['Count'];
                if(a.Plurality['Primary'] > b.Plurality['Primary']) return 1;
                if(a.Plurality['Primary'] < b.Plurality['Primary']) return -1;
                return 0;
            });
        } else if(this.ops['Tweets']['Order'].is('disagreement')) {
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
                   coder_id == 'all' ? (this.n.codes_per_tweet > 2.5 ? 'Majority' : 'Coder 1') : coder.ShortName + "'s Label",
                   coder_id == 'all' ? (this.n.codes_per_tweet > 2.5 ? 'Minority' : 'Coder 2') : "Other's Label"])
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
                    if(this.n.codes_per_tweet > 2.5) {
                        this.code_list.primary6.forEach(function(code) {
                            var n_votes_for = d.Votes[code].length;
                            if (n_votes_for > d.Votes['Count'] / 2 || d.Plurality['Primary'] == code) {
                                text += "<span class='code_Primary code_" + code + "'>" + code;
                                if(this.n.codes_per_tweet > 2.5) text += ' (' + n_votes_for + ')';
                                text += '</span><br />';
                            }
                        }, this);
                        var num_uncertain = d['Votes']['Uncertainty'].length;
                        if(num_uncertain > d.Votes['Count'] / 2) {
                            text += "<span class='code_Uncertainty'>Uncertainty";
                            if(this.n.codes_per_tweet > 2.5) text += ' (' + num_uncertain + ')';
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
                    this.code_list.primary6.forEach(function(code) {
                        if (d.Votes[code].includes(coder_id)) {
                            text += "<span class='code_Primary code_" + code + "'>" + code + "</span><br \>";
                        }
                    });
                    if(d.Votes['Uncertainty'].includes(coder_id)) {
                        text += "<span class='code_Uncertainty'>Uncertainty</span>"
                    }
                }
            
                return text;
            }.bind(this))
            .attr('class', 'cell-tweetvote');
        
        rows.append('td')
            .html(function(d) {
                var text = '';
                if(coder_id == 'all') {
                    if(this.n.codes_per_tweet > 2.5) {
                        this.code_list.primary6.forEach(function(code) {
                            var n_votes_for = d.Votes[code].length;
                            if (n_votes_for <= d.Votes['Count'] / 2 && n_votes_for > 0 && d.Plurality['Primary'] != code) {
                                text += "<span class='code_Primary code_" + code + "'>" + code;
                                if(this.n.codes_per_tweet > 2.5) text += ' (' + n_votes_for + ')';
                                text += '</span><br />';
                            }
                        }, this);

                        var num_uncertain = d['Votes']['Uncertainty'].length;
                        if(num_uncertain > 0 && num_uncertain <= d.Votes['Count'] / 2) {
                            text += "<span class='code_Uncertainty'>Uncertainty";
                            if(this.n.codes_per_tweet > 2.5) text += ' (' + num_uncertain + ')';
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
                    this.code_list.primary6.forEach(function(code) {
                        var n_votes_for = d.Votes[code].length - (d.Votes[code].includes(coder_id) ? 1 : 0);
                        if (n_votes_for > 0) {
                            text += "<span class='code_Primary code_" + code + "'>" + code;
                            if(this.n.codes_per_tweet > 2.5 || n_votes_for > 1) text += ' (' + n_votes_for + ')';
                            text += '</span><br />';
                        }
                    }, this);
                    var num_uncertain = d['Votes']['Uncertainty'].length - (d.Votes['Uncertainty'].includes(coder_id) ? 1 : 0);
                    if(num_uncertain > 0) {
                        text += "<span class='code_Uncertainty'>Uncertainty";
                        if(this.n.codes_per_tweet > 2.5 || num_uncertain > 1) text += ' (' + num_uncertain + ')';
                        text += '</span><br />';
                    }
                }
            
                return text;
            }.bind(this))
            .attr('class', 'cell-tweetvote');
        
        this.tooltip.attach('.cell-tweetvote', this.tweetVoteHoverInfo.bind(this));
        
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
    tweetVoteHoverInfo: function(d) {
        var voters = d.Votes['Coders'];
        var votes = {};
        voters.forEach(function(voter) { votes[voter] = ''; });
        
        this.code_list.any.forEach(function(code) {
            d.Votes[code].forEach(function(voter) {
                votes[voter] += code + ' ';
            });
        });
        
        if(!this.ops['Matrices']['Order'].is('anonymous')) {
            var votes2 = {};
            voters.forEach(function(voter) {
                var name = this.coders[voter - 1].ShortName;
                votes2[name] = votes[voter];
            }, this)
            votes = votes2;
        }
        
        return votes;
    },
    togglePane: function(pane) {
        var duration = 10;
        if(pane instanceof Array) {
            duration = pane[1];
            pane = pane[0];
        }
        
        if(this.ops[pane].Show.is("true")) {
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
    getTweetDetails: function() {
        var post = {
            rumor_id: this.ops['Dataset']['Rumor'].get(),
            period: this.ops['Dataset']['Period'].get()
        };
        
        // Wait otherwise some page elements may be stuck
        setTimeout(function() {
            this.connection.phpjson('coding/getTweets', post, triggers.emitter('tweet details: parse'));
        }.bind(this), 1000);
    },
    parseTweetDetails: function(tweetDetails) {
        // Add information to the tweets
        tweetDetails.forEach(function(tweetDetail) {
            var tweet = this.tweets[tweetDetail.ID];
            if(tweet) {
                tweet.Text = tweetDetail.Text;
                tweet.Type = tweetDetail.Type;
                tweet.ExpandedURL = tweetDetail.ExpandedURL;
            } else {
//                console.log('Somethings wrong mapping tweets, couldn\'t find ID ' + tweetDetail.ID);
            }
        }, this);
        
        triggers.emit('tweet details: processed');
    },
    tweetTypeTable: function() {
        triggers.emit('toggle_pane', 'Tweet Types');
        
        var rows = ['Uncodable', 'Unrelated', 'Affirm', 'Deny', 'Neutral', 'Uncertainty', 'Total'];
        var columns = ['Original', 'Retweet', 'Reply', 'Quote', 'Unknown', 'Total'];
        
        this.code_type_counts = rows.map(function(row) {
            return columns.map(function(col) {
                return {
                    Code: row,
                    Type: col,
                    Value: 0,
                    Of: 0
                }
            })
        })
        
        this.tweets_arr.forEach(function(tweet) {
            var type = tweet.Type || 'Unknown';
            if(type.charAt(0) >= 'a') type = type.charAt(0).toUpperCase() + type.substring(1);
            var i_type = columns.indexOf(type);
            this.code_type_counts[6][i_type]['Value'] += 1; // total
            
            this.code_list.binary.forEach(function(code, i_code) {
                var votes     = tweet.Votes['Count'];
                var votes_for = tweet.Votes[code].length;
                this.code_type_counts[i_code][i_type]['Value'] += votes_for / votes;
                this.code_type_counts[i_code][5]['Value'] += votes_for / votes; // total
            }, this);
        }, this);
        
        // Add totals
        var denom = this.ops['Tweet Types']['Bars'].get();
        this.code_type_counts[6][5].Value = d3.sum(this.code_type_counts[6], function(d) { return d.Value; });
        this.code_type_counts.forEach(function(row, i_code) {
            row.forEach(function(cell, i_type) {
                cell['Of'] = this.code_type_counts[denom == 'code' ? i_code : 6][denom == 'tweet_type' ? i_type : 5].Value;
            }, this);
        }, this);
        
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
            .data(this.code_type_counts)
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
};

function initialize() {
    CD = new Coding();   
    CD.init();
}
window.onload = initialize;