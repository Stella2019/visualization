// Coding refers to the coding group, annotating tweets
var coding, options, data;

function Coding() {
    var events;
    var rumors;
    var rumor;
    var coders;
    var codes;
}
Coding.prototype = {
    getData: function() {
        data.callPHP('coding/getCoders', {}, function(d) {
            coding.coders = JSON.parse(d);
            
            data.callPHP('collection/getEvents', {}, function(d) {
                coding.events = JSON.parse(d);

                data.callPHP('collection/getRumors', {}, function(d) {
                    coding.rumors = JSON.parse(d);
                    coding.buildDropdowns();
                });
            });
        });
    },
    buildDropdowns: function() {
        // Rumors
        var labels = coding.rumors.map(function(rumor) {
            rumor.event = coding.events.filter(function(event){
                return event.ID == rumor.Event_ID;
            })[0];
            return rumor.event.Name + ": " + rumor.Name;
        });
        var ids = coding.rumors.map(function(rumor) {
            return rumor.ID;
        });
        
        options.rumor = new Option({
            title: 'Rumor',
            labels: labels,
            ids:    ids,
            default: 0,
            type: "dropdown",
            parent: '#options',
            callback: coding.getCodes
        });
        options.buildDropdown('rumor');
        
        // Period
        options.period = new Option({
            title: 'Period',
            labels: ['Training', 'Coding', 'Adjudicated'],
            ids:    [-1, 0, 1],
            default: 1,
            type: "dropdown",
            parent: '#options',
            callback: coding.getCodes
        });
        options.buildDropdown('period');
        
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
            default: 0,
            type: "dropdown",
            parent: '#options',
            callback: coding.compileReport
        });
        options.buildDropdown('coder');
        
        // Types of disagreement        
        options.tweets_shown = new Option({
            title: 'Tweets Shown',
            labels: ['All',
                     'Any Disagreement',
                     'Disagreement on Primary Code',
                     'Disagreement on Uncodable',
                     'Disagreement on Unrelated',
                     'Disagreement on Affirm',
                     'Disagreement on Deny',
                     'Disagreement on Neutral',
                     'Disagreement on Uncertainty'],
            ids:    ["All", "Disagreement", "Primary", "Uncodable", "Unrelated", "Affirm", "Deny", "Neutral", "Uncertainty"],
            default: 0,
            type: "dropdown",
            parent: '#options',
            callback: coding.getTweets
        });
        options.buildDropdown('tweets_shown');
        
        // Start drawing
        options.rumor.click(4);
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
        
        var codes = ["Primary", "Uncodable", "Unrelated", "Affirm", "Deny", "Neutral", "Uncertainty"];
        var primary_codes = ["Uncodable", "Unrelated", "Affirm", "Deny", "Neutral"];
        var binary_codes = ["Uncodable", "Unrelated", "Affirm", "Deny", "Neutral", "Uncertainty"];
        
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
                        Uncodable: [],
                        Unrelated: [],
                        Affirm: [],
                        Deny: [],
                        Neutral: [],
                        Uncertainty: []
                    },
                    Plurality: {
                        Count: 0,
                        Primary: '',
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
                
                binary_codes.forEach(function(c) {
                    if(code[c] == '1') {
                        tweet.Votes[c].push(code.Coder);
                    }
                });
            }
        });
        
        // Initialize objects
        var n_tweets = coding.tweets_arr.length
761;
        var n_coders = Object.keys(coding.coders).length;
        coding.coders_x_coders_possible = util.zeros(n_coders, n_coders);
        coding.coders_x_coders_primary = util.zeros(n_coders, n_coders);
        coding.coders_x_coders_uncertainty_1 = util.zeros(n_coders, n_coders);
        coding.coders_x_coders_uncertainty_2 = util.zeros(n_coders, n_coders);
        coding.codes_x_codes = util.zeros(primary_codes.length, primary_codes.length);
        
        var code_agreement = {};
        var code_agreement_arr = [];
        codes.forEach(function(code) {
            var entry = {
                Code: code,
                Count: 0,
                Average: 0,
                Unanimous: 0,
                Plurality: 0,
                JustPlurality: 0,
                Any: 0,
                Minority: 0,
                
                Average_Of_All: 0,
                Unanimous_Of_All: 0,
                Plurality_Of_All: 0,
                Any_Of_All: 0,
                Unanimous_Of_Any: 0,
                JustPlurality_Of_Any: 0,
                Minority_Of_Any: 0,
                
                Alpha: 0,
                Agreement: 0
            };
            code_agreement[code] = entry;
            code_agreement_arr.push(entry);
        });
        
        // Find majority agreement
        coding.tweets_arr.forEach(function(tweet) {                        
            // Get the plurality
            tweet.Plurality['Count'] = d3.max(primary_codes, function(code) { return tweet.Votes[code].length; });
            primary_codes.forEach(function(code) {
                tweet.Plurality[code] = tweet.Votes[code].length == tweet.Plurality['Count'];
                if(!tweet.Plurality['Primary'] && tweet.Plurality[code])
                    tweet.Plurality['Primary'] = code;
                if(!tweet.Plurality[code] && tweet.Votes[code].length > 0)
                    tweet.Plurality.Others += code + '(' + tweet.Votes[code].length + ') ';
            })
            tweet.Plurality['Uncertainty'] = tweet.Votes['Uncertainty'].length / tweet.Votes['Count'] >= 0.5;
            tweet.Primary_Disagreement     = tweet.Votes['Count'] != tweet.Plurality['Count'];
            tweet.Uncertainty_Disagreement = tweet.Votes['Count'] != tweet.Votes['Uncertainty'].length;
            
            // Find disagreement
            codes.forEach(function(code) {
                var votes_for, plurality;
                if(code == 'Primary') {
                    votes_for = tweet.Votes[code].filter(function(d) { return d != 'No Code'; }).length;
                    plurality = tweet.Plurality[code] != 'No Code';
                } else {
                    votes_for = tweet.Votes[code].length;
                    plurality = tweet.Plurality[code];
                }
                var votes     = tweet.Votes['Count'];
                var unanimous = votes_for == votes;
                var any       = votes_for > 0;
                    
                var entry = code_agreement[code];
                entry['Count']++;
                entry['Average']       += votes_for / votes;
                entry['Unanimous']     += unanimous               ? 1 : 0;
                entry['Plurality']     += plurality               ? 1 : 0;
                entry['JustPlurality'] += plurality && !unanimous ? 1 : 0,
                entry['Any']           += any                     ? 1 : 0;
                entry['Minority']      += any       && !plurality ? 1 : 0;
            })
            
            tweet.Votes.Coders.map(function(coder1) {
                tweet.Votes.Coders.map(function(coder2) {
                    coding.coders_x_coders_possible[coder1 - 1][coder2 - 1]++;
                    if(!tweet.Primary_Disagreement)
                        coding.coders_x_coders_primary[coder1 - 1][coder2 - 1]++;
                    
                    if(tweet.Votes['Uncertainty'].length > 0)
                        coding.coders_x_coders_uncertainty_1[coder1 - 1][coder2 - 1]++ // any
                    if(tweet.Votes['Uncertainty'].length == tweet.Votes['Count'])
                        coding.coders_x_coders_uncertainty_2[coder1 - 1][coder2 - 1]++ // all
                })
            })
        });
        
            
//            var coder1 = tweet['Coder 1'];
//            var coder2 = tweet['Coder 2'];
//            
//            codes.forEach(function(code, i) {
//                var code1 = tweet[code + ' 1'];
//                var code2 = tweet[code + ' 2'];
//                var pos_code1 = code1 != "0" && code1 != "No Code";
//                var pos_code2 = code2 != "0" && code2 != "No Code";
//                code_agreement[i]['Average Yes'] += (pos_code1 ? 0.5 : 0) + (pos_code2 ? 0.5 : 0);
//                code_agreement[i]['1+ Yes']      += pos_code1 || pos_code2 ? 1 : 0;
//                
//                code_agreement[i]['Disagreed']
//                
//                // Coder specific
//                if(coder1 == coder_id) {
//                    code_agreement[i]['Coder Yes'] += pos_code1 ? 1 : 0;
//                    code_agreement[i]['Other Yes'] += pos_code2 ? 1 : 0;
//                } else if(coder2 == coder_id) {
//                    code_agreement[i]['Coder Yes'] += pos_code2 ? 1 : 0;
//                    code_agreement[i]['Other Yes'] += pos_code1 ? 1 : 0;
//                }
//            });
//            
//            // Add to matrix
//            var primary1 = primary_codes.indexOf(tweet['Primary 1']);
//            var primary2 = primary_codes.indexOf(tweet['Primary 2']);
//            if(primary1 >= 0 && primary2 >= 0) {
//                coding.codes_x_codes[primary1][primary2]++;
//                coding.codes_x_codes[primary2][primary1]++;
//            } else {
//                console.log(coder1, tweet['Primary 1'], coder2, tweet['Primary 2']);
//            }
//            coding.coders_x_coders_possible[coder1 - 1][coder2 - 1]++;
//            coding.coders_x_coders_possible[coder2 - 1][coder1 - 1]++;
//            if(primary1 == primary2) {
//                coding.coders_x_coders_primary[coder1 - 1][coder2 - 1]++;
//                coding.coders_x_coders_primary[coder2 - 1][coder1 - 1]++;
//            }
//            
//            if(tweet['Uncertainty 1'] == "1" || tweet['Uncertainty 2'] == "1") {
//                coding.coders_x_coders_uncertainty_1[coder1 - 1][coder2 - 1]++;
//                coding.coders_x_coders_uncertainty_1[coder2 - 1][coder1 - 1]++;
//            }
//            if(tweet['Uncertainty 1'] == "1" && tweet['Uncertainty 2'] == "1") {
//                coding.coders_x_coders_uncertainty_2[coder1 - 1][coder2 - 1]++;
//                coding.coders_x_coders_uncertainty_2[coder2 - 1][coder1 - 1]++;
//            }
//        });
        
        // Order coders by how well they did
        if(coder_id == 'all') {
            var coder_agrees = coding.coders_x_coders_primary.map(function(d) { return d3.sum(d); });
            var coder_possible = coding.coders_x_coders_possible.map(function(d) { return d3.sum(d); });
            var coder_agree_perc = coder_agrees.map(function(d, i) { return d / (coder_possible[i] || 1); });
            var coder_order = d3.range(n_coders).sort(function(a, b) { return coder_agree_perc[b] - coder_agree_perc[a]; });
            var available = [0]; // All
            coder_order.forEach(function(i) { 
                if(coder_agree_perc[i] > 0)
                    available.push(i + 1);
            });
            options.coder.available = available;
            options.buildDropdown('coder');
        }
        
        // Get proportional statistics
        codes.forEach(function(code) {
            var entry = code_agreement[code];
                entry['Average_Of_All'] = entry['Average'] / entry['Count']; 
                entry['Unanimous_Of_All'] = entry['Unanimous'] / entry['Count']; 
                entry['Plurality_Of_All'] = entry['Plurality'] / entry['Count']; 
                entry['Minority_Of_All'] = entry['Minority'] / entry['Count']; 
                entry['Any_Of_All'] = entry['Any'] / entry['Count']; 
                entry['Unanimous_Of_Any'] = entry['Unanimous'] / entry['Any']; 
                entry['JustPlurality_Of_Any'] = entry['JustPlurality'] / entry['Any']; 
                entry['Minority_Of_Any'] = entry['Minority'] / entry['Any']; 
        });

        // Get totals
//        code_agreement.forEach(function (code) {
//            code['Just Coder Yes'] = code['Coder Yes'] - code['Both Yes'];
//            code['Just Other Yes'] = code['Other Yes'] - code['Both Yes'];
//            
//            code['Average Yes of All'] = code['Average Yes'] / n;
//            code['1+ Yes of All'] = code['1+ Yes'] / n;
//            code['Both Yes of 1+ Yes'] = code['Both Yes'] / code['1+ Yes'];
//            code['Disagreed of 1+ Yes'] = code['Disagreed'] / code['1+ Yes'];
//            code['Disagreed of All'] = code['Disagreed'] / n;
//            code['Coder Yes of 1+ Yes'] = code['Coder Yes'] / code['1+ Yes'];
//            code['Just Coder Yes of 1+ Yes'] = code['Just Coder Yes'] / code['1+ Yes'];
//            code['Just Other Yes of 1+ Yes'] = code['Just Other Yes'] / code['1+ Yes'];
//        });
        
        // Krippendorff's Alpha
        // http://repository.upenn.edu/cgi/viewcontent.cgi?article=1043&context=asc_papers
        var primary_codes = ['Uncodable', 'Unrelated', 'Affirm', 'Deny', 'Unrelated'];
        codes_tweets_votes = codes.map(function(code) {
            if(code == 'Primary') {
                return coding.tweets_arr.map(function(tweet) {
                    var arr = [0, 0, 0, 0, 0];
                    tweet.Votes.Primary.forEach(function(vote) {
                        var codei = primary_codes.indexOf(vote);
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
        codes.forEach(function(code, j) {
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
            console.log(code + ' Krippendorff\'s Alpha = ' + 
                        '1 - (' + n_votes + ' - 1) * ' + 
                        D_o + ' / ' + D_e + ' = ' + 
                        krippendorff_alpha.toFixed(2));
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
        
        // Write data
        coding.code_agreement_arr = code_agreement_arr;
        coding.fillTable();
    },
    fillTable: function() {
        var coder_id = options.coder.get();
        
        var results_div = d3.select("#general_results");
        results_div.selectAll("*").remove();
        
        var agreement_table = results_div.append("table")
            .attr('id', 'agreement_table')
            .attr('class', 'table');
        
        var columns = ['Code',
           'Average Positive<br /><small>(% of All)</small>',
           'Plurality Positive<br /><small>(% of All)</small>', 
           'Disagreed<br /><small>(% of All)</small>', 
           'Unanimous Positive<br /><small>(% of Any Positive)</small>'];
        if(coder_id != 'all') {
            var coder_name = coding.coders[parseInt(coder_id) - 1].ShortName;
            columns.push('Just ' + coder_name + '<br /><small>(% of Any Positive)</small>');
            columns.push('Only Other(s) Positive<br /><small>(% of Any Positive)</small>');
        } else {
            columns.push('Plurality not All Positive<br /><small>(% of Any Positive)</small>');
            columns.push('Minority Positive<br /><small>(% of Any Positive)</small>');
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
        rows.append('td')
            .html(function(d) {
                return d['Average'].toFixed(0) + " <small>(" + 
                    (d['Average_Of_All'] * 100).toFixed(0) + 
                    "%)</small>";
            })
            .attr('class', 'table_stat')
            .append('div')
            .style({
                width: function(d) { 
                    return (d['Average_Of_All'] * 90) + '%'}
            })
            .attr('class', 'table_bar');
        rows.append('td')
            .html(function(d) {
                return d['Plurality'] + " <small>(" + 
                    (d['Plurality_Of_All'] * 100).toFixed(0) + 
                    "%)</small>";
            })
            .attr('class', 'table_stat')
            .append('div')
            .style({
                width: function(d) {
                    return (d['Plurality_Of_All'] * 90) + '%'}
            })
            .attr('class', 'table_bar');
        rows.append('td')
            .html(function(d) {
                return d['Minority'] + " <small>(" + 
                    (d['Minority_Of_All'] * 100).toFixed(0) + 
                    "%)</small>";
            })
            .attr('class', 'table_stat')
            .append('div')
            .style({
                width: function(d) { 
                    return (d['Minority_Of_All'] * 90) + '%'},
            })
            .attr('class', 'table_bar');
        
        // Of 1+ Yes
        rows.append('td')
            .html(function(d) {
                return d['Unanimous'] + " <small>(" + 
                    (d['Unanimous_Of_Any'] * 100).toFixed(0) + 
                    "%)</small>";
            })
            .attr('class', 'table_stat')
            .append('div')
            .style({
                width: function(d) { 
                    return (d['Unanimous_Of_Any'] * 90) + '%'},
                background: '#ddd'
            })
            .attr('class', 'table_bar');
        
//        if(coder_id == 'all') {
            rows.append('td')
                .html(function(d) {
                    return d['JustPlurality'] + " <small>(" + 
                        (d['JustPlurality_Of_Any'] * 100).toFixed(0) + 
                        "%)</small>";
                })
                .attr('class', 'table_stat')
                .append('div')
                .style({
                    width: function(d) { 
                        return (d['JustPlurality_Of_Any'] * 90) + '%'},
                    background: '#ddd'
                })
                .attr('class', 'table_bar');
            rows.append('td')
                .html(function(d) {
                    return d['Minority'] + " <small>(" + 
                        (d['Minority_Of_Any'] * 100).toFixed(0) + 
                        "%)</small>";
                })
                .attr('class', 'table_stat')
                .append('div')
                .style({
                    width: function(d) { 
                        return (d['Minority_Of_Any'] * 90) + '%'},
                    background: '#ddd'
                })
                .attr('class', 'table_bar');
//        } else {
//            rows.append('td')
//                .html(function(d) {
//                    return d['Just Coder Yes'] + " <small>(" + 
//                        (d['Just Coder Yes of 1+ Yes'] * 100).toFixed(0) + 
//                        "%)</small>";
//                })
//                .attr('class', 'table_stat')
//                .append('div')
//                .style({
//                    width: function(d) { 
//                        return (d['Just Coder Yes of 1+ Yes'] * 90) + '%'},
//                    background: '#ddd'
//                })
//                .attr('class', 'table_bar');
//            rows.append('td')
//                .html(function(d) {
//                    return d['Just Other Yes'] + " <small>(" + 
//                        (d['Just Other Yes of 1+ Yes'] * 100).toFixed(0) + 
//                        "%)</small>";
//                })
//                .attr('class', 'table_stat')
//                .append('div')
//                .style({
//                    width: function(d) { 
//                        return (d['Just Other Yes of 1+ Yes'] * 90) + '%'},
//                    background: '#ddd'
//                })
//                .attr('class', 'table_bar');
//        }
        
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
        
        coding.fillMatrices();
        coding.getTweets();
    },
    fillMatrices: function() {
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
//            return name.split(' ').map(function(name_part) {
//                return name_part[0];
//            }).join('');
            return i + " ";
        });
        
        /* Primary coder matrix */
        var matrix = options.coder.available.map(function (i) {
            var row = options.coder.available.map(function (j) {
                if(i == 0) return coder_names[j];
                if(j == 0) return coder_names[i];
                return Math.floor(coding.coders_x_coders_primary[i - 1][j - 1] /
                                  coding.coders_x_coders_possible[i - 1][j - 1] * 100) || 0;
            });
            if(i == 0) {
                row.push('&sum;');
            } else {
                row.push(Math.floor(
                         d3.sum(coding.coders_x_coders_primary[i - 1]) / 
                         d3.sum(coding.coders_x_coders_possible[i - 1]) * 100));
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
            .html(function(d) { return d; })
            .style('background-color', function(d) {
                if(typeof(d) == "string") 
                    return 'white';
                return color(d);
            });
        
        /* Uncertainty coder matrix */
        matrix = options.coder.available.map(function (i) {
            var row = options.coder.available.map(function (j) {
                if(i == 0) return coder_names[j];
                if(j == 0) return coder_names[i];
                return Math.floor(coding.coders_x_coders_uncertainty_2[i - 1][j - 1] /
                                  coding.coders_x_coders_uncertainty_1[i - 1][j - 1] * 100) || 0;
            });
            if(i == 0) {
                row.push('&sum;');
            } else {
                row.push(Math.floor(
                         d3.sum(coding.coders_x_coders_uncertainty_2[i - 1]) / 
                         d3.sum(coding.coders_x_coders_uncertainty_1[i - 1]) * 100));
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
            .html(function(d) { return d; })
            .style('background-color', function(d) {
                if(typeof(d) == "string") 
                    return 'white';
                return color(d);
            });
        
        
        /* Code matrix */
        var code_names = ['', 'Unc', 'Unr', 'Aff', 'Den', 'Neu', '&sum;'];
        matrix = code_names.map(function (row_name, i) {
            var row = code_names.map(function (col_name, j) {
                if(i == 0) return {val: col_name, max: -1};
                if(j == 0) return {val: row_name, max: -1};
                if(i == 6 && j == 6) return {val: d3.sum(coding.codes_x_codes, function(d) { return d3.sum(d); }), max: -1};
                if(i == 6)return {val: d3.sum(coding.codes_x_codes, function(d) { return d[j - 1];}), max: -1};
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
        div.append('div')
            .html('Code Confusion')
            .attr('class', 'col-sm-4')
            .append('table')
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
    getTweets: function() {
        var coder_id = options.coder.get();
        var coder = {};
        if(coder_id != 'all') {
            coder = coding.coders[parseInt(coder_id) - 1];
        }
        var tweets_shown = options.tweets_shown.get();
        var tweets = coding.tweets_arr;
//        
//        // Filter out tweets by coder
//        if(coder_id != 'all') {
//            tweets = tweets.filter(function(code) {
//                return code['Coder 1'] == coder_id || code['Coder 2'] == coder_id;
//            });
//        }
        
        // Add other codes for tweets
        tweets.forEach(function(tweet) {
//            tweet.code1 = tweet['Plurality']['Primary']
//            tweet.code2 = tweet['Plurality']['Primary']
//            
//            tweet.code1 = tweet['Uncertainty 1'];
//            if(tweet.code1 == "0") tweet.code1 = 'No Uncertainty';
//            if(tweet.code1 == "1") tweet.code1 = 'Uncertainty';
            tweet.code1 = tweet['Plurality']['Primary'] + '<br/>' +
                '<small>Uncertainty: ' + tweet['Plurality']['Uncertainty'] + '</small>';

            tweet.code2 = tweet['Uncertainty 2'];
            if(tweet.code2 == "0") tweet.code2 = 'No Uncertainty';
            if(tweet.code2 == "1") tweet.code2 = 'Uncertainty';
            tweet.code2 = tweet['Primary 2'] + '<br/>' +
                '<small>' + tweet.code2 + '</small>';
        });
        
        // Filter out tweets by disagreement
        if(tweets_shown == 'Disagreement') {
            
            tweets = tweets.filter(function(tweet) {
                return tweet.Primary_Disagreement || tweet.Uncertainty_Disagreement;
            });
//            tweets = tweets.filter(function(tweet) {
//                return (tweet['Primary Agreement'] == "0" ||
//                   tweet['Uncertainty Agreement'] == "0");
//            });
        } else if(tweets_shown != 'All') {
            tweets = tweets.filter(function(tweet) {
                return tweet[tweets_shown + ' 1'] != tweet[tweets_shown + ' 2'];
            });
        }
        
        // Add the table
        d3.select('#tweet_table').remove();
        var table = d3.select('#individual_results')
            .append('table')
            .attr('id', 'tweet_table')
            .attr('class', 'table table-hover');
        
        table.append('thead')
            .append('tr')
            .selectAll('th')
            .data(['Tweet ID',
                   'Text',
                   coder_id == 'all' ? 'Plurality' : coder.ShortName + "'s Label",
                   coder_id == 'all' ? 'All' : "Other's Label"])
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
            .html(function(d) { return d.Tweet; });
        rows.append('td')
            .html(function(d) { return d.Text; });
        
        rows.append('td')
            .html(function(d) {
                var i = 1;
                if(d['Coder 2'] == coder_id)
                    i = 2;
            
                return "" +
                    "<span class='code_Primary code_" + d['Plurality']['Primary'] + "'>" + d['Plurality']['Primary'] + '(' + d['Plurality']['Count'] + ")</span>" +
                    "<br />" +
                    (d['Votes']['Uncertainty'].length >= 5 ? "<span class='code_Uncertainty'>" + (d['Votes']['Uncertainty'].length > 0 ? "Uncertainty " + d['Votes']['Uncertainty'].length : "-")  + "</span>" : '');
            });
        rows.append('td')
            .html(function(d) {
                var i = 2;
                if(d['Coder 2'] == coder_id)
                    i = 1;
            
                return "" +
                    "<span class='code_Primary code_" + d['Plurality']['Primary'] + "'>" + d['Plurality']['Others'] + "</span>" +
                    "<br />" +
                    (d['Votes']['Uncertainty'].length < 5 ? "<span class='code_Uncertainty'>" + (d['Votes']['Uncertainty'].length > 0 ? "Uncertainty " + d['Votes']['Uncertainty'].length : "-")  + "</span>" : '');
//                return d;
//                return "" +
//                    "<span class='code_Primary code_" + d['Primary ' + i] + "'>" + d['Primary ' + i] + "</span>" +
//                    "<br />" +
//                    "<span class='code_Uncertainty'>" + (d['Uncertainty ' + i] == "1" ? "Uncertainty" : "-")  + "</span>"
            });
        
        if(tweets_shown == 'Disagreement') {
            d3.selectAll('span.code_Uncertainty')
                .classed('small', true);
        } else if(tweets_shown != 'All') {
            d3.selectAll('span.code_' + tweets_shown)
                .style('font-weight', 'bold');
            if(tweets_shown == 'Uncertainty') {
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
    }
};

function initialize() {
    coding = new Coding();
    options = new Options();
    data = new Data();
    
    coding.getData();
}
window.onload = initialize;