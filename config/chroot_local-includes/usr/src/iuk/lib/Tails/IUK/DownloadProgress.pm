=head1 NAME

Tails::IUK::DownloadProgress - keeps tracks of the progress of an ongoing download

=cut

package Tails::IUK::DownloadProgress;

no Moo::sification;
use Moo;

use 5.10.1;
use strictures 2;

use autodie qw(:all);
use Types::Standard qw{Num Str HashRef};
use Time::HiRes;
use Time::Duration;
use Function::Parameters;

with 'Tails::IUK::Role::FormatByte';

use Locale::TextDomain 'tails';

use namespace::clean;

has 'size' => (
    is       => 'ro',
    isa      => Num,
    required => 1,
);

has 'size_left' => (
    is       => 'rw',
    isa      => Num,
    lazy     => 1,
    init_arg => 'size',
);

foreach (qw{speed last_byte_downloaded last_progress_time}) {
    has "$_" => (
        is       => 'rw',
        isa      => Num,
        default  => 0,
        init_arg => undef,
    );
}

has 'update_interval_time' => (
    is            => 'ro',
    isa           => Num,
    default       => 0.4,
    documentation => q{Default update value, based on Doherty Threshold},
);

has 'estimated_end_time' => (
    is      => 'rw',
    isa     => Str,
    lazy    => 1,
    default => __(q{Unknow time}),
);

has 'time_units' => (
    is  => 'lazy',
    isa => HashRef[Str],
);

has 'smoothing_factor' => (
    is      =>  'ro',
    isa     =>  Num,
    default =>  0.1,
);

method _build_time_units () {
    {
        year   => __(q{y}),
        day    => __(q{d}),
        hour   => __(q{h}),
        minute => __(q{m}),
        second => __(q{s}),
    };
}

# Based on the code in  DownloadCore.jsm in Tor Browser
method update (Num $downloaded_byte) {
    my $current_time = Time::HiRes::gettimeofday();
    my $elapsed_time = $current_time - $self->last_progress_time;
    return if ($elapsed_time < $self->update_interval_time);

    $self->download_speed($downloaded_byte, $elapsed_time);
    $self->size_left($self->size - $downloaded_byte);
    $self->estimated_end_time($self->estimate_end_time);
    $self->last_byte_downloaded($downloaded_byte);
    $self->last_progress_time($current_time);
}

method download_speed (Num $downloaded_byte, Num $elapsed_time) {
    my $raw_speed = ($downloaded_byte - $self->last_byte_downloaded)/$elapsed_time;
    if ($self->speed == 0) {
        $self->speed($raw_speed);
    }
    else {
        # Apply exponential smoothing.
        $self->speed(
            ($raw_speed * $self->smoothing_factor)
            +
            ($self->speed * (1 - $self->smoothing_factor))
        );
    }
}

method estimate_end_time () {
    return if ($self->speed <= 0);
    my $timeleft =  $self->size_left / $self->speed;
    $timeleft = duration($timeleft);
    return if $timeleft eq 'just now';
    $timeleft =~ s/\band\b//;
    $timeleft =~
        s/\b(year|day|hour|minute|second)s?\b
        /$self->time_units->{$1}/egx;
    $timeleft =~ s/(\d+)\s*/$1/g;
    return $timeleft;
}

method info () {
    __x(
        "#{time} left — {downloaded} of {size} ({speed}/sec)\n",
        time       => $self->estimated_end_time,
        downloaded => $self->format_bytes($self->last_byte_downloaded),
        size       => $self->format_bytes($self->size),
        speed      => $self->format_bytes($self->speed),
        );
}

no Moo;
1;
