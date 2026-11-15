module Admin
  class BaseController < ApplicationController
    before_action { authorize :admin, :access? }
  end
end
