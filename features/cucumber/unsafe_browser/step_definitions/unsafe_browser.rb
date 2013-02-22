When /^I see and accept the Unsafe Browser start verification$/ do
  @screen.wait("UnsafeBrowserStartVerification.png", 10)
  @screen.type("l", Sikuli::KEY_ALT)
end

Then /^I see and close the Unsafe Browser start notification$/ do
  @screen.wait("UnsafeBrowserStartNotification.png", 10)
  @screen.click("UnsafeBrowserStartNotification.png")
end

Then /^the Unsafe Browser has started$/ do
  @screen.wait("UnsafeBrowserWindow.png", 30)
end

Then /^the Unsafe Browser has a red theme$/ do
  @screen.wait("UnsafeBrowserRedTheme.png", 10)
end

Then /^the Unsafe Browser has Wikipedia pre-selected in the search bar$/ do
  @screen.wait("UnsafeBrowserSearchBar.png", 10)
end

Then /^the Unsafe Browser shows a warning as its start page$/ do
  @screen.wait("UnsafeBrowserStartPage.png", 10)
end

When /^I start the Unsafe Browser$/ do
  step "I run \"gksu unsafe-browser\""
  step "I see and accept the Unsafe Browser start verification"
  step "I see and close the Unsafe Browser start notification"
  step "the Unsafe Browser has started"
end

Then /^I see a warning about another instance already running$/ do
  @screen.wait('UnsafeBrowserWarnAlreadyRunning.png', 10)
end

When /^close the Unsafe Browser$/ do
  @screen.type("q", Sikuli::KEY_CTRL)
end

Then /^I see the Unsafe Browser stop notification$/ do
  @screen.wait('UnsafeBrowserStopNotification.png', 20)
  @screen.waitVanish('UnsafeBrowserStopNotification.png', 20)
end

Then /^I can start the Unsafe Browser again$/ do
  step "I start the Unsafe Browser"
end

When /^I open a new tab in the Unsafe Browser$/ do
  next if @skip_steps_while_restoring_background
  @screen.wait("UnsafeBrowserWindow.png", 10)
  @screen.click("UnsafeBrowserWindow.png")
  @screen.type("t", Sikuli::KEY_CTRL)
end

When /^I open the address "([^"]*)" in the Unsafe Browser$/ do |address|
  next if @skip_steps_while_restoring_background
  step "I open a new tab in the Unsafe Browser"
  @screen.type("l", Sikuli::KEY_CTRL)
  @screen.type(address + Sikuli::KEY_RETURN)
end


Then /^I cannot configure the Unsafe Browser to use any local proxies$/ do
  # First we open the proxy settings page to prepare it with the
  # correct open tabs for the loop below.
  @screen.type("e", Sikuli::KEY_ALT)
  @screen.type("n")
  @screen.wait('UnsafeBrowserPreferences.png', 10)
  @screen.wait('UnsafeBrowserAdvancedSettings.png', 10)
  @screen.click('UnsafeBrowserAdvancedSettings.png')
  @screen.wait('UnsafeBrowserNetworkTab.png', 10)
  @screen.click('UnsafeBrowserNetworkTab.png')
  sleep 0.5
  @screen.type(Sikuli::KEY_ESC)
#  @screen.waitVanish('UnsafeBrowserPreferences.png', 10)
  sleep 0.5

  http_proxy  = 'x' # Alt+x is the shortcut to select http proxy
  socks_proxy = 'c' # Alt+c for socks proxy
  no_proxy    = 'y' # Alt+y for no proxy

  # Note: the loop below depends on that http_proxy is done after any
  # other proxy types since it will set "Use this proxy server for all
  # protocols", which will make the other proxy types unselectable.
  proxies = [[socks_proxy, 9050],
             [socks_proxy, 9061],
             [socks_proxy, 9062],
             [socks_proxy, 9063],
             [http_proxy,  8118],
             [no_proxy,       0]]

  proxies.each do |proxy|
    proxy_type = proxy[0]
    proxy_port = proxy[1]

    # Open proxy settings and select manual proxy configuration
    @screen.type("e", Sikuli::KEY_ALT)
    @screen.type("n")
    @screen.wait('UnsafeBrowserPreferences.png', 10)
    @screen.type("e", Sikuli::KEY_ALT)
    @screen.wait('UnsafeBrowserProxySettings.png', 10)
    @screen.type("m", Sikuli::KEY_ALT)

    # Configure the proxy
    @screen.type(proxy_type, Sikuli::KEY_ALT)  # Select correct proxy type
    @screen.type("localhost\t#{proxy_port}") if proxy_type != no_proxy
    # For http proxy we set "Use this proxy server for all protocols"
    @screen.type("s", Sikuli::KEY_ALT) if proxy_type == http_proxy

    # Close settings settings
    @screen.type(Sikuli::KEY_RETURN)
#    @screen.waitVanish('UnsafeBrowserProxySettings.png', 10)
    sleep 0.5
    @screen.type(Sikuli::KEY_ESC)
#    @screen.waitVanish('UnsafeBrowserPreferences.png', 10)
    sleep 0.5

    # Test that the proxy settings work as they should
    step "I open the address \"https://check.torproject.org\" in the Unsafe Browser"
    if proxy_type == no_proxy
      @screen.wait('UnsafeBrowserTorCheckFail.png', 60)
    else
      @screen.wait('UnsafeBrowserProxyRefused.png', 60)
    end
  end
end
