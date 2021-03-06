import uuid
from django.core.urlresolvers import reverse
from django.db import models
from timezone_field import TimeZoneField
from django.contrib.auth.models import User
from django.utils import timezone
from django.conf import settings
from model_base.base import Base


# Create your models here.
class Meeting(Base):
    creator = models.ForeignKey(User, related_name='meetings', db_index=True)
    timezone = TimeZoneField(default=settings.TIME_ZONE)#
    activation_date = models.DateTimeField(help_text='Choose time when this meeting shall become active')
    duration = models.PositiveIntegerField(help_text='Choose duration in minutes for which the meeting shall be active')
    end_date = models.DateTimeField(null=True, blank=True, editable=False)
    room_id = models.CharField(max_length=200, editable=False, blank=True, null=True)


    def _setup(self):
        if self.room_id is None:
            self.room_id = '%s.%s' % (self.creator.id, uuid.uuid4())
            self.save()

    def meeting_url(self):
        '''
            This shall avail the url which shall be used to access the meeting room.
            Typically, it shall be available until only until the meeting has ended
            For now, only until there is an it's only when there is an end date.
        :return:
        '''
        #import pdb; pdb.set_trace()
        if self.activation_date < timezone.now():
            self._setup()
            if self.room_id:
                return reverse('join_meeting', kwargs={'room_id': self.room_id})