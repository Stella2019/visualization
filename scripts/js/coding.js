// Coding refers to the coding group, annotating tweets
var coding, options, data;

function Coding() {
    this.events = [];
    this.rumors = [];
    this.rumor = {};
    this.coders = [];
    this.codes = {};
    
    this.rumor_period_counts = {};
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
            return rumor.event.Name + ": " + rumor.Name;
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
        options.initial_buttons = ['rumor', 'period', 'coder', 'tweets_shown', 'anonymous'];
        options.record = options.initial_buttons;
        options.rumor = new Option({
            title: 'Rumor',
            labels: labels,
            ids:    ids,
            available: available,
            default: 4,
            type: "dropdown",
            parent: '#options',
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
            parent: '#options',
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
            parent: '#options',
            callback: coding.compileReport
        });
        
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
        
        // Types of disagreement        
        options.anonymous = new Option({
            title: "Anonymous",
            styles: ["btn btn-sm btn-default", "btn btn-sm btn-primary"],
            labels: ["<span class='glyphicon glyphicon-ban-circle'></span> Anonymous", "<span class='glyphicon glyphicon-ok-circle'></span> Anonymous"],
            ids:    ["false", "true"],
            default: 1,
            type: "toggle",
            parent: '#options',
            callback: coding.fillTable
        });
        
        // Start drawing
        options.init();
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
                        tweet.Votes[c].push(parseInt(code.Coder));
                    }
                });
            }
        });
        
        // Initialize objects
        var n_tweets = coding.tweets_arr.length
761;
        var n_coders = coding.coders.length;
        coding.coders_x_coders_possible = util.zeros(n_coders, n_coders);
        coding.coders_x_coders_primary = util.zeros(n_coders, n_coders);
        coding.coders_x_majority_primary = util.zeros(n_coders, 1);
        coding.coders_x_majority_uncertainty = util.zeros(n_coders, 1);
        coding.coders_x_coders_uncertainty_either = util.zeros(n_coders, n_coders);
        coding.coders_x_coders_uncertainty_both = util.zeros(n_coders, n_coders);
        coding.codes_x_codes = util.zeros(primary_codes.length, primary_codes.length);
        
        var code_agreement = {};
        var code_agreement_arr = [];
        codes.forEach(function(code) {
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
            tweet.Plurality['Count'] = d3.max(primary_codes, function(code) { return tweet.Votes[code].length; });
            primary_codes.forEach(function(code) {
                tweet.Plurality[code] = tweet.Votes[code].length == tweet.Plurality['Count'];
                if(!tweet.Plurality['Primary'] && tweet.Plurality[code])
                    tweet.Plurality['Primary'] = code;
            })
            tweet.Plurality['Uncertainty'] = tweet.Votes['Uncertainty'].length / tweet.Votes['Count'] >= 0.5;
            tweet.Primary_Disagreement     = tweet.Votes['Count'] != tweet.Plurality['Count'];
            tweet.Uncertainty_Disagreement = (tweet.Votes['Count'] != tweet.Votes['Uncertainty'].length) && tweet.Votes['Uncertainty'].length > 0;
            
            // Find disagreement
            codes.forEach(function(code) {
                var votes_for, plurality, coder_yes;
                if(code == 'Primary') {
                    votes_for = tweet.Votes[code].filter(function(d) { return d != 'No Code'; }).length;
                    var coder_index = tweet.Votes['Coders'].indexOf(parseInt(coder_id));
                    coder_yes = coder_index > 0 && tweet.Votes[code][coder_index] != 'No Code';
                    plurality = tweet.Plurality[code] != 'No Code';
                } else {
                    votes_for = tweet.Votes[code].length;
                    coder_yes = tweet.Votes[code].includes(parseInt(coder_id));
                    plurality = tweet.Plurality[code];
                }
                var votes     = tweet.Votes['Count'];
                var unanimous = votes_for == votes;
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
                
                var primary_icoder = primary_codes.indexOf(primary1);
                var primary_iplur = primary_codes.indexOf(tweet.Plurality['Primary']);
                if(primary_icoder >= 0 && primary_iplur >= 0)
                    coding.codes_x_codes[primary_icoder][primary_iplur]++;
                       
                tweet.Votes.Coders.map(function(coder2, ic2) {
                    var primary2 = tweet.Votes['Primary'][ic2];
                    coding.coders_x_coders_possible[coder1 - 1][coder2 - 1]++;
                    if(primary1 == primary2)
                        coding.coders_x_coders_primary[coder1 - 1][coder2 - 1]++;
                    
                    var uncertainty2 = tweet.Votes['Uncertainty'].includes(coder2);
                    if(uncertainty1 || uncertainty2)
                        coding.coders_x_coders_uncertainty_either[coder1 - 1][coder2 - 1]++ // any
                    if(uncertainty1 && uncertainty2)
                        coding.coders_x_coders_uncertainty_both[coder1 - 1][coder2 - 1]++ // all
                })
            })
        });
        
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
            
            if(options.anonymous.is('true')) {
                available.sort(function(a, b) { return a - b; });
            }
            options.coder.available = available;
            options.buildDropdown('coder');
        }

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
           'Average Chose<br /><small>(% of All)</small>',
           'Majority Chose<br /><small>(% of All)</small>', 
           'Disagreed<br /><small>(% of All)</small>', 
           'Unanimous<br /><small>(% of Any Positive)</small>'];
        if(coder_id != 'all') {
            var coder_name = coding.coders[parseInt(coder_id) - 1].ShortName;
            columns.push(coder_name + ' Chose<br /><small>(% of Any Positive)</small>');
            columns.push('Other Chose<br /><small>(% of Any Positive)</small>');
        } else {
            if(options.period.get() < 0) {
                columns.push('Majority (not all) Chose<br /><small>(% of Any Positive)</small>');
            }
            columns.push('Minority Chose<br /><small>(% of Any Positive)</small>');
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
        
        var cols = [{
            value: 'Average',
            of: 'All'
        },{
            value: 'Plurality',
            of: 'All'
        },{
            value: options.period.get() < 0 ? 'Minority' : 'NotUnanimous',
            of: 'All'
        },{
            value: 'Unanimous',
            of: 'Any'
        }];
        if(coder_id != 'all') {
            cols.push({
                value: 'JustCoder',
                of: 'Any'
            });
            cols.push({
                value: 'JustOther',
                of: 'Any'
            });
        } else {
            if(options.period.get() < 0) {
                cols.push({
                    value: 'JustPlurality',
                    of: 'Any'
                });
            }
            cols.push({
                value: options.period.get() < 0 ? 'Minority' : 'NotUnanimous',
                of: 'Any'
            });
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
            if(options.anonymous.is("true"))
                return i + " ";
            
            return name.split(' ').map(function(name_part) {
                return name_part[0];
            }).join('');
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
                return Math.floor(coding.coders_x_coders_uncertainty_both[i - 1][j - 1] /
                                  coding.coders_x_coders_uncertainty_either[i - 1][j - 1] * 100) || 0;
            });
            if(i == 0) {
                row.push('&sum;');
            } else {
                row.push(Math.floor(
                         d3.sum(coding.coders_x_coders_uncertainty_both[i - 1]) / 
                         d3.sum(coding.coders_x_coders_uncertainty_either[i - 1]) * 100));
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
                transform: 'translateY(35%)',
                width: '1.5em'
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
    getTweets: function() {
        var coder_id = options.coder.get();
        coder_id = parseInt(coder_id) || 'all';
        var coder = {};
        if(coder_id != 'all') {
            coder = coding.coders[coder_id - 1];
        }
        var tweets_shown = options.tweets_shown.get();
        var tweets = coding.tweets_arr;
        var period = options.period.get();
        
        // Filter out tweets by coder
        if(coder_id != 'all') {
            tweets = tweets.filter(function(tweet) {
                console.log(tweet.Votes.Coders, coder_id, tweet.Votes.Coders.includes(coder_id));
                return tweet.Votes.Coders.includes(coder_id);
            });
        }
        
        // Filter out tweets by disagreement
        if(tweets_shown != 'All') {
            if(period < 0 && coder_id != 'all') {
                var codes = [tweets_shown];
                if(tweets_shown == 'Primary') {
                    codes = ['Uncodable', 'Unrelated', 'Affirm', 'Deny', 'Neutral'];
                } else if(tweets_shown == 'Disagreement') {
                    codes = ['Uncodable', 'Unrelated', 'Affirm', 'Deny', 'Neutral', 'Uncertainty'];
                }

                tweets = tweets.filter(function(tweet) {
                    return codes.reduce(function(disagreed, code) {
                        var coder_yes = tweet.Votes[code].includes(coder_id);
                        var group_yes = tweet.Plurality[code];
                        return disagreed || (group_yes ? !coder_yes : coder_yes);
                    }, false);
                });
            } else {
                if(tweets_shown == 'Disagreement') {
                    tweets = tweets.filter(function(tweet) {
                        return tweet.Primary_Disagreement || tweet.Uncertainty_Disagreement;
                    });
                } else if(tweets_shown == 'Primary') {
                    tweets = tweets.filter(function(tweet) {
                        return tweet.Primary_Disagreement;
                    });
                } else {
                    tweets = tweets.filter(function(tweet) {
                        return tweet.Votes[tweets_shown].length > 0 && (tweet.Votes[tweets_shown].length != tweet.Votes.Count);
                    });
                }
            }
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
                   coder_id == 'all' ? (period < 0 ? 'Majority' : 'Coder 1') : coder.ShortName + "'s Label",
                   coder_id == 'all' ? (period < 0 ? 'Minority' : 'Coder 2') : "Other's Label"])
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
                var text = '';
                if(coder_id == 'all') {
                    if(period < 0) {
                        ['Uncodable', 'Unrelated', 'Affirm', 'Deny', 'Neutral'].forEach(function(code) {
                            var n_votes_for = d.Votes[code].length;
                            if (n_votes_for > d.Votes['Count'] / 2 || d.Plurality['Primary'] == code) {
                                text += "<span class='code_Primary code_" + code + "'>" + code;
                                if(period < 0) text += ' (' + n_votes_for + ')';
                                text += '</span><br />';
                            }
                        });
                        var num_uncertain = d['Votes']['Uncertainty'].length;
                        if(num_uncertain > d.Votes['Count'] / 2) {
                            text += "<span class='code_Uncertainty'>Uncertainty";
                            if(period < 0) text += ' (' + num_uncertain + ')';
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
                    ['Uncodable', 'Unrelated', 'Affirm', 'Deny', 'Neutral'].forEach(function(code) {
                        if (d.Votes[code].includes(coder_id)) {
                            text += "<span class='code_Primary code_" + code + "'>" + code + "</span><br \>";
                        }
                    });
                    if(d.Votes['Uncertainty'].includes(coder_id)) {
                        text += "<span class='code_Uncertainty'>Uncertainty</span>"
                    }
                }
            
                return text;
            });
        rows.append('td')
            .html(function(d) {
                var text = '';
                if(coder_id == 'all') {
                    if(period < 0) {
                        ['Uncodable', 'Unrelated', 'Affirm', 'Deny', 'Neutral'].forEach(function(code) {
                            var n_votes_for = d.Votes[code].length;
                            if (n_votes_for <= d.Votes['Count'] / 2 && n_votes_for > 0 && d.Plurality['Primary'] != code) {
                                text += "<span class='code_Primary code_" + code + "'>" + code;
                                if(period < 0) text += ' (' + n_votes_for + ')';
                                text += '</span><br />';
                            }
                        });

                        var num_uncertain = d['Votes']['Uncertainty'].length;
                        if(num_uncertain > 0 && num_uncertain <= d.Votes['Count'] / 2) {
                            text += "<span class='code_Uncertainty'>Uncertainty";
                            if(period < 0) text += ' (' + num_uncertain + ')';
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
                    ['Uncodable', 'Unrelated', 'Affirm', 'Deny', 'Neutral'].forEach(function(code) {
                        var n_votes_for = d.Votes[code].length - (d.Votes[code].includes(coder_id) ? 1 : 0);
                        if (n_votes_for > 0) {
                            text += "<span class='code_Primary code_" + code + "'>" + code + "</span>";
                            if(period < 0) text += '(' + n_votes_for + ')';
                            text += '<br />';
                        }
                    });
                    var num_uncertain = d['Votes']['Uncertainty'].length - (d.Votes['Uncertainty'].includes(coder_id) ? 1 : 0);
                    if(num_uncertain > 0) {
                        text += "<span class='code_Uncertainty'>Uncertainty</span>";
                        if(period < 0) text += '(' + num_uncertain + ')';
                        text += '<br />';
                    }
                }
            
                return text;
            
//                return "" +
//                    "<span class='code_Primary code_" + d['Plurality']['Primary'] + "'>" + d['Plurality']['Others'] + "</span>" +
//                    "<br />" +
//                    (d['Votes']['Uncertainty'].length < 5 ? "<span class='code_Uncertainty'>" + (d['Votes']['Uncertainty'].length > 0 ? "Uncertainty " + d['Votes']['Uncertainty'].length : "-")  + "</span>" : '');
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
            if(tweets_shown != 'Primary') {
                d3.selectAll('span.code_' + tweets_shown)
                    .style('font-weight', 'bold');
            }
            
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