/* functions used in 'personal' visualization */


function getPubKey() {
    const t = window.location.href.split('/#').pop();
    if(t.length != 44 ) console.log("Wrong token length in the URL", t.length);
    return t;
}

function personal(pages, profile) {

    if(!pages) pagestr = '10-0';
    else {
        $("#report").empty();
        pagestr = 10 + '-' + (pages - 10);
    }
    const pk = getPubKey();
    if(!_.size(pk)) {
        $(".potrex--content").hide();
        $("#missingkey").show();
        return;
    }
    const url = buildApiUrl('personal', pk + '/' + pagestr);
    $.getJSON(url, (data) => {
        _.each(data.recent, function(entry, i) {
            if(entry.type == 'video') {
                addVideoRow(entry, i);
            } else if(entry.type == 'home') {
                addHomePage(entry, i);
            } else {
                console.log("Unmanaged condition?", entry);
            }
        });
        addPages(data.total, pagestr);
        if(!profile) updateProfileInfo(data.supporter);

        console.log("Invoking radar rendering using only one profile");
        let categories = _.flatten(_.compact(_.map(data.recent, 'categories')));
        let list = _.reverse(_.sortBy(_.map(_.countBy(categories), function(c, n) { return { c, n, } }), 'c'));
        let considered = _.map(_.take(list, 20), 'n');

        const axes1 = _.map(considered, function(cat) {
            let ref = _.countBy(categories);
            let amount = _.get(ref, cat, 0);
            let value = _.round(amount / _.size(data.recent), 2);
            return {
                axis: cat,
                value
            };
        });

        const monotop = [{
            name: "xxxx",
            axes: axes1,
        }, {
            name: "aaaa",
            axes: []
        }];
        /* this is part of the conversion shared with lib/basic (function 'radar') */
        render(monotop);
        $(".loader").hide();
    });
}

function updateProfileInfo(profile) {
    const publicKey = `${profile.publicKey}`;
    const userName = `${profile.p}`;
    const createdAt = new Date(`${profile.creationTime}`);
    const lastActivity = new Date(`${profile.lastActivity}`);
    const createdAtFormatted = createdAt.toUTCString();
    const lastActivityFormatted = lastActivity.toUTCString();

    $('#createdAtFormatted').text(createdAtFormatted);
    $('#accessToken').text(publicKey);
    $('#lastActivityFormatted').text(lastActivityFormatted);
    $('#user-name').text(userName);

    if (profile.tag) {
        $("#tag-name").text(profile.tag.name);
        $("#tag-badge").removeAttr('hidden');
        console.log('tag only ---', profile.tag);
    }
    console.log("profile display", profile);
}

let lastHomepageId = null;
function addHomePage(data, i) {
    const entry = $("#masterHome").clone();
    const computedId = `homepage-${data.id}`;
    entry.attr("id", computedId);
    $("#report").append(entry);

    if(lastHomepageId == data.metadataId)
        return;
    /* else, we should display the entry */
    lastHomepageId = data.metadataId;

    console.log(i, "HOMEPAGE", data);
    _.each(data.sections, function(s) {
        let current = $("#" + computedId + " .sections").html();
        current += s.display + "</br>";
        $("#" + computedId + " .sections").html(current);

        current = $("#" + computedId + " .videonumber").html();
        current += _.size(s.videos) + " videos" + "</br>";
        $("#" + computedId + " .videonumber").html(current);
    });
    entry.removeAttr('hidden');
}

function printMessage(element, text, type) {
    if(!type) var type = 'danger';
    element.html('<p class="alert alert-' + type + ' mb-3">' + text + '</p>');
}

function createTag() { return manageTag('create'); }
function joinTag() { return manageTag('join'); }
function manageTag(action) {
    const pk = getPubKey();
    const error = $('#error');
    const resultDiv = $('#result');
    error.empty();
    resultDiv.empty();

    console.log("manageTag", action)

    const tag = $('#tag').val();
    const password = $("#password").val();
    const description = $("#description").val();
    const private = $("#private").is(':checked')

    /* in data we add the tag info to be sent */
    let data = {
        tag,
        password,
        description,
        accessibility: private ? 'private': 'public'
    };

    /* this was happening in development, maybe never happen in production */
    if( _.size(password) > 0 && data.accessibility == 'private')
        $("#group-password-wrapper").show();
    if( _.size(description) >  0 && action == 'create' )
        $("#description-block").show();

    /* validation */
    if(_.size(tag) == 0) {
        printMessage(error, 'Please, enter a tag name.');
        return;
    }

    if(action == 'create') {
        $("#description-block").show();
        if(_.size(description) == 0) {
            printMessage(error, 'Please add a description to the new tag');
            return;
        }
    } else {
        $("#description-block").hide();
        _.unset(data, 'description');
    }

    if(private) {
        $("#group-password-wrapper").show();
        if(_.size(password) < 8) {
            printMessage(error, 'Private tag require a password longer than 8 keys.');
            return;
        }
    } else {
        data.password = "";
        $("#group-password-wrapper").hide();
    }

    /* XHR section */
    let url = null;
    if(action == 'create')
        url = buildApiUrl(`profile/${pk}/tag`, null, 2);
    else /* action == 'update' */
        url = buildApiUrl(`profile/${pk}`, null, 2);

    console.log("Ready to ", action, tag, "via", url);

    return fetch(url, {
        method: 'POST', // *GET, POST, PUT, DELETE, etc.
        mode: 'cors', // no-cors, *cors, same-origin
        cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
        credentials: 'same-origin', // include, *same-origin, omit
        headers: {
            'Content-Type': 'application/json'
        },
        redirect: 'follow', // manual, *follow, error
        referrer: 'no-referrer', // no-referrer, *client
        body: JSON.stringify(data) // body data type must match "Content-Type" header
    }).then(function(response) {
        return response.json();
    }).then(function(result) {
        if(result.error == true) {
            console.log("Server side error:", result);
            printMessage(resultDiv, result.message);
        }
        else {
            updateProfileInfo(result.profile);
            printMessage(resultDiv, 'Tag "<b>' + result.group.name + '</b>" has been created', 'success');
        }
        return result;
    })
    .catch(function(e) {
        printMessage(error, "fail to communicate with the server");
        console.log(e.message);
    });
}

function downloadCSV() {
    const pk = getPubKey();
    const csvurl = serverWrap(`/api/v1/personal/${pk}/csv`);
    console.log("downloadCSV from: ", csvurl);
    window.open(csvurl);
}

function addPages(total, pages) {
    const ul = $('#pagination').find('ul');
    const pageString = pages.split('-').pop();
    const actualPage = pageString.slice(0, -1);

    ul.empty();
    if(total > 10) {
        var page;
        const pagesNumber = _.round(total / 10);
        // const description = `There are <b>${total}</b> evidences. Page <b>${actualPage}</b> of <b>${pagesNumber}</b>`;
        const description = `Page <b>${actualPage}</b> of <b>${pagesNumber}</b>`;
        $('#total-evidence').html(description);
        for (page = 1; page < pagesNumber + 1; page++) {
            let liStyle = '';
            let pageValue =  page + '0';
            if (pageValue == ( (_.parseInt(actualPage) || 0) + 1 ) + '0')  liStyle = ' red';
            ul.append('<li class="page-item"><a class="page-link' + liStyle + '" onclick="personal(' + pageValue + ', true)">'+ page +'</a></li>');
        }
    }
}

let lastMetadataId = null;
function addVideoRow(video, i) {
    const entry = $("#master").clone();
    const computedId = `video-${video.id}`;
    entry.attr("id", computedId);
    $("#report").append(entry);

    if(lastMetadataId == video.metadataId)
        return;
    /* else, we should display the entry */
    lastMetadataId = video.metadataId;

    console.log(i, video);
    $("#" + computedId + " .compare").attr('href', `/compare/#${video.videoId}`);
    let title = $("#" + computedId + " .compare").attr('title') + "«" + video.title + "»";
    $("#" + computedId + " .compare").attr('title', title);

    $("#" + computedId + " .producer").text(video.producer.name + ' [' + video.producer.type + ']');

    $("#" + computedId + " .related").attr('href', `/related/#${video.videoId}`);
    title = $("#" + computedId + " .related").attr('title')  + "«" + video.title + "»";
    $("#" + computedId + " .related").attr('title', title);

    $("#" + computedId + " .author").attr('href', `/author/#${video.videoId}`);

    $("#" + computedId + " .delete").on('click', removeEvidence);
    $("#" + computedId + " .delete").attr('yttrex-id', `${video.id}`);
    title = $("#" + computedId + " .delete").attr('title')  + "«" + video.title + "»";
    $("#" + computedId + " .delete").attr('title', title);

    $("#" + computedId + " .relative").text(video.relative);
    $("#" + computedId + " .title").text(video.title);
    $("#" + computedId + " .categories").text(video.categories.join(','));

    entry.removeAttr('hidden');
}

function removeEvidence(e) {
    const id = $(this).attr('yttrex-id');
    const pk = getPubKey();
    const deleteURL = buildApiUrl(`personal/${pk}/selector/id/${id}`, null, 2);
    console.log(deleteURL);
    return fetch(deleteURL, {
        method: 'DELETE',
        mode: 'cors', // no-cors, *cors, same-origin
        cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
        credentials: 'same-origin', // include, *same-origin, omit
        redirect: 'follow', // manual, *follow, error
        referrer: 'no-referrer' // no-referrer, *client
    }).then(function(response) {
        console.log(response);
        return response.json();
    }).then(function(result) {
        const selectorId = `#video-${id}`;
        $(selectorId).fadeOut(300);
        console.log(result);
    });
}

function showPassword(status) {
    if( status == 'private') $('#group-password-wrapper').show();
    else $('#group-password-wrapper').hide();
}
