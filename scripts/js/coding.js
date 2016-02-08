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
            rumor_id: options.rumor.get()
        };

        data.callPHP('coding/get', post, coding.parseCodes);
    },
    parseCodes: function(file_data) {
        coding.codes = JSON.parse(file_data);
        coding.compileReport();
    },
    compileReport: function() {
        // Filter by Coders
        var coder_id = options.coder.get();
        var tweets = coding.codes;
        if(coder_id != 'all') {
            tweets = tweets.filter(function(tweets) {
                return tweets['Coder 1'] == coder_id || tweets['Coder 2'] == coder_id;
            });
        }
        
        // Process data
        var n = tweets.length;
        var cats = ["Primary", "Uncodable", "Unrelated", "Affirm", "Deny", "Neutral", "Uncertainty"];
        var cat_agreement = cats.map(function(cat) {
            var entry = {
                'Code': cat,
                'Main': ['Primary', 'Uncertainty'].includes(cat),
                'Average Yes': 0,
                '>= 1 Yes': 0,
                'Both Yes': 0,
                'Disagreed': 0
            }
            return entry;
        });
        tweets.forEach(function(code) {
            cats.forEach(function(cat, i) {
                var code1 = code[cat + ' 1'];
                var code2 = code[cat + ' 2'];
                cat_agreement[i]['Average Yes'] += (code1 != "0" ? 0.5 : 0) + (code2 != "0" ? 0.5 : 0);
                cat_agreement[i]['>= 1 Yes'] += (code1 != "0") || (code2 != "0") ? 1 : 0;
                cat_agreement[i]['Both Yes'] += (code1 != "0") && (code2 != "0") ? 1 : 0;
                cat_agreement[i]['Disagreed'] += (code1 != code2) ? 1 : 0;
            })
        });
        
        // Get totals
        cat_agreement.forEach(function (cat) {
            cat['Average Yes of All'] = cat['Average Yes'] / n;
            cat['>= 1 Yes of All'] = cat['>= 1 Yes'] / n;
            cat['Both Yes of >= 1 Yes'] = cat['Both Yes'] / cat['>= 1 Yes'];
            cat['Disagreed of >= 1 Yes'] = cat['Disagreed'] / cat['>= 1 Yes'];
            cat['Disagreed of All'] = cat['Disagreed'] / n;
        });
        
        // Krippendorff's Alpha
        // http://repository.upenn.edu/cgi/viewcontent.cgi?article=1043&context=asc_papers
        var primary_codes = ['Uncodable', 'Unrelated', 'Affirm', 'Deny', 'Unrelated'];
        cats_tweets_votes = cats.map(function(cat) {
            if(cat == 'Primary') {
                return tweets.map(function(code) {
                    var arr = [0, 0, 0, 0, 0];
                    var code1 = primary_codes.indexOf(code[cat + ' 1']);
                    var code2 = primary_codes.indexOf(code[cat + ' 2']);
                    if(code1 >= 0) arr[code1] += 1;
                    if(code2 >= 0) arr[code2] += 1;
                    return arr;
                })
            } else {
                return tweets.map(function(code) {
                    var arr = [0, 0];
                    var code1 = parseInt(code[cat + ' 1']);
                    var code2 = parseInt(code[cat + ' 2']);
                    arr[code1] += 1;
                    arr[code2] += 1;
                    return arr;
                })
            }   
        });
        cats.forEach(function(cat, j) {
            var n_vals = cat == 'Primary' ? 5 : 2;
            var total_votes = d3.range(n_vals)
                                .map(function () { return 0; });
            var D_o = d3.sum(cats_tweets_votes[j], function(votes) {
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
            // really it's just cat['Disagreed'];
            var D_e = d3.sum(d3.range(n_vals), function(c) {
                return d3.sum(d3.range(c + 1, n_vals), function(k) {
                    return (total_votes[c] * total_votes[k]) || 0; 
                    // * distance, which is 0 for nominal
                }) || 0;
            });
            
            var n_votes = d3.sum(total_votes);
            var krippendorff_alpha = 1 - (n_votes - 1) * D_o / D_e;
            console.log(cat + ' Krippendorff\'s Alpha = ' + 
                        '1 - (' + n_votes + ' - 1) * ' + 
                        D_o + ' / ' + D_e + ' = ' + 
                        krippendorff_alpha.toFixed(2));
            cat_agreement[j]["Krippendorff's Alpha"] = krippendorff_alpha;
            
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
            cat_agreement[j]["Agreement Level"] = agreement;
        });
        
        // Write data
        coding.fillTable(cat_agreement);
    },
    fillTable: function(cat_agreement) {
        var results_div = d3.select("#general_results");
        results_div.selectAll("*").remove();
        
        var agreement_table = results_div.append("table")
            .attr('id', 'agreement_table')
            .attr('class', 'table');
        
        agreement_table.append('thead')
            .append('tr')
            .selectAll('th')
            .data(['Code',
                   'Average Codes<br /><small>(% of All)</small>',
                   '&le; 1 Code<br /><small>(% of All)</small>', 
                   'Disagreed<br /><small>(% of All)</small>', 
                   'Both Coded<br /><small>(% of &le; 1 Code)</small>', 
                   'One Coded<br /><small>(% of &le; 1 Code)</small>', 
                   'Krippendorff\'s Alpha<br /><small>(Agreement)</small>'])
            .enter()
            .append('th')
            .html(function(d) { return d; }) 
        
        var rows = agreement_table.append('tbody')
            .selectAll('tr')
            .data(cat_agreement)
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
                return d['Average Yes'] + " <small>(" + 
                    (d['Average Yes of All'] * 100).toFixed(0) + 
                    "%)</small>";
            })
            .style('position', 'relative')
            .append('div')
            .style({
                width: function(d) { 
                    return (d['Average Yes of All'] * 90) + '%'}
            })
            .attr('class', 'table_bar');
        rows.append('td')
            .html(function(d) {
                return d['>= 1 Yes'] + " <small>(" + 
                    (d['>= 1 Yes of All'] * 100).toFixed(0) + 
                    "%)</small>";
            })
            .style('position', 'relative')
            .append('div')
            .style({
                width: function(d) {
                    return (d['>= 1 Yes of All'] * 90) + '%'}
            })
            .attr('class', 'table_bar');
        rows.append('td')
            .html(function(d) {
                return d['Disagreed'] + " <small>(" + 
                    (d['Disagreed of All'] * 100).toFixed(0) + 
                    "%)</small>";
            })
            .style('position', 'relative')
            .append('div')
            .style({
                width: function(d) { 
                    return (d['Disagreed of All'] * 90) + '%'},
            })
            .attr('class', 'table_bar');
        
        // Of >= 1 Yes
        rows.append('td')
            .html(function(d) {
                return d['Both Yes'] + " <small>(" + 
                    (d['Both Yes of >= 1 Yes'] * 100).toFixed(0) + 
                    "%)</small>";
            })
            .style('position', 'relative')
            .append('div')
            .style({
                width: function(d) { 
                    return (d['Both Yes of >= 1 Yes'] * 90) + '%'},
                background: '#ddd'
            })
            .attr('class', 'table_bar');
        rows.append('td')
            .html(function(d) {
                return d['Disagreed'] + " <small>(" + 
                    (d['Disagreed of >= 1 Yes'] * 100).toFixed(0) + 
                    "%)</small>";
            })
            .style('position', 'relative')
            .append('div')
            .style({
                width: function(d) { 
                    return (d['Disagreed of >= 1 Yes'] * 90) + '%'},
                background: '#ddd'
            })
            .attr('class', 'table_bar');
        
        var agreements = ['Poor', 'Slight', 'Fair', 'Moderate', 'Substantial', 'Perfect'];
        var agreement_colors = ['black', '#d62728', '#ff7f0e', '#bcbd22', '#2ca02c', '#1f77b4']; // '#17becf'
        rows.append('td')
            .html(function(d) {
                var agreement = agreements[d['Agreement Level']];
            
                return d['Krippendorff\'s Alpha'].toFixed(2) + 
                    " <small>(" + agreement + ")</small>";
            })
            .style('position', 'relative')
            .append('div')
            .style({
                width: function(d) { 
                    return (d['Krippendorff\'s Alpha'] * 90) + '%'},
                background: function(d) { 
                    return agreement_colors[d['Agreement Level']]}
            })
            .attr('class', 'table_bar');
        
        coding.getTweets();
    },
    getTweets: function() {
        var coder_id = options.coder.get();
        var coder = {};
        if(coder_id != 'all') {
            coder = coding.coders[parseInt(coder_id) - 1];
        }
        var tweets_shown = options.tweets_shown.get();
        var tweets = coding.codes;
        
        // Filter out tweets by coder
        if(coder_id != 'all') {
            tweets = tweets.filter(function(code) {
                return code['Coder 1'] == coder_id || code['Coder 2'] == coder_id;
            });
        }
        
        // Add other codes for tweets
        tweets.forEach(function(tweet) {
            tweet.code1 = tweet['Uncertainty 1'];
            if(tweet.code1 == "0") tweet.code1 = 'No Uncertainty';
            if(tweet.code1 == "1") tweet.code1 = 'Uncertainty';
            tweet.code1 = tweet['Primary 1'] + '<br/>' +
                '<small>' + tweet.code1 + '</small>';

            tweet.code2 = tweet['Uncertainty 2'];
            if(tweet.code2 == "0") tweet.code2 = 'No Uncertainty';
            if(tweet.code2 == "1") tweet.code2 = 'Uncertainty';
            tweet.code2 = tweet['Primary 2'] + '<br/>' +
                '<small>' + tweet.code2 + '</small>';
        });
        
        // Filter out tweets by disagreement
        if(tweets_shown == 'Disagreement') {
            tweets = tweets.filter(function(tweet) {
                return (tweet['Primary Agreement'] == "0" ||
                   tweet['Uncertainty Agreement'] == "0");
            });
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
                   coder_id == 'all' ? 'Coder 1' : coder.ShortName + "'s Label",
                   coder_id == 'all' ? 'Coder 2' : "Other's Label"])
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
                    "<span class='code_Primary code_" + d['Primary ' + i] + "'>" + d['Primary ' + i] + "</span>" +
                    "<br />" +
                    "<span class='code_Uncertainty'>" + (d['Uncertainty ' + i] == "1" ? "Uncertainty" : "-")  + "</span>"
            });
        rows.append('td')
            .html(function(d) {
                var i = 2;
                if(d['Coder 2'] == coder_id)
                    i = 1;
            
                return "" +
                    "<span class='code_Primary code_" + d['Primary ' + i] + "'>" + d['Primary ' + i] + "</span>" +
                    "<br />" +
                    "<span class='code_Uncertainty'>" + (d['Uncertainty ' + i] == "1" ? "Uncertainty" : "-")  + "</span>"
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