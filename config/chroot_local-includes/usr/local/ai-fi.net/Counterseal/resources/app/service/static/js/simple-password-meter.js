$(document).ready(function() {
    $("#passphrase-tf").on("keypress keyup keydown", function() {
        let pass = $(this).val();
        let result = zxcvbn(pass);

        if (result.score == 0) {
            $("#strength_human").css({color: '#990033'});
        } else if (result.score == 1) {
            $("#strength_human").css({color: '#FF6600'});
        } else if (result.score == 2) {
            $("#strength_human").css({color: '#CCCC33'});
        } else if (result.score == 3) {
            $("#strength_human").css({color: '#CCFF99'});
        } else if (result.score == 4) {
            $("#strength_human").css({color: '#009966'});
        }
        
        $("#strength_human").text(result.crack_times_display.online_throttling_100_per_hour + ' to crack');
        //$("#strength_score").text(scorePassword(pass));
    });
});
