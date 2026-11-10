/// Plain models for what the app shows. JSON shapes follow the API's envelope
/// `data` payloads (see web/src/api/types.ts for the same structures).
class Me {
  Me({required this.id, required this.handle, required this.displayName, required this.uiLanguage, required this.role});
  final String id;
  final String handle;
  final String displayName;
  final String uiLanguage;
  final String role;
  factory Me.fromJson(Map<String, dynamic> j) => Me(
        id: j['id'] as String,
        handle: j['handle'] as String,
        displayName: j['displayName'] as String,
        uiLanguage: (j['uiLanguage'] as String?) ?? 'sw',
        role: (j['role'] as String?) ?? 'reader',
      );
}

class WorkCard {
  WorkCard({
    required this.id,
    required this.slug,
    required this.title,
    required this.synopsis,
    required this.language,
    required this.kind,
    required this.status,
    required this.access,
    required this.previewParts,
    required this.ownerHandle,
    required this.ownerName,
    this.volumes = const [],
    this.genre,
    this.rating = 'general',
    this.lastPublicAt,
    this.publicParts = 0,
    this.followers = 0,
  });
  final String id, slug, title, synopsis, language, kind, status, access, ownerHandle, ownerName, rating;
  final String? genre;
  final List<String> volumes;
  final int previewParts, publicParts, followers;
  final DateTime? lastPublicAt;
  bool get isPoetry => kind == 'poem' || kind == 'poem_collection';
  bool get isCollection => kind == 'book_collection';

  factory WorkCard.fromJson(Map<String, dynamic> j) {
    final owner = (j['owner'] as Map<String, dynamic>?) ?? const {};
    final count = (j['_count'] as Map<String, dynamic>?) ?? const {};
    return WorkCard(
      id: j['id'] as String,
      slug: j['slug'] as String,
      title: j['title'] as String,
      synopsis: (j['synopsis'] as String?) ?? '',
      language: (j['language'] as String?) ?? 'sw',
      kind: (j['kind'] as String?) ?? 'series',
      status: (j['status'] as String?) ?? 'ongoing',
      access: (j['access'] as String?) ?? 'public',
      previewParts: (j['previewParts'] as int?) ?? 10,
      ownerHandle: (owner['handle'] as String?) ?? '',
      ownerName: (owner['displayName'] as String?) ?? '',
      volumes: ((j['volumes'] as List?) ?? const []).cast<String>(),
      genre: j['genre'] as String?,
      rating: (j['rating'] as String?) ?? 'general',
      lastPublicAt: j['lastPublicAt'] != null ? DateTime.tryParse(j['lastPublicAt'] as String) : null,
      publicParts: (count['parts'] as int?) ?? 0,
      followers: (count['follows'] as int?) ?? 0,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'slug': slug,
        'title': title,
        'synopsis': synopsis,
        'language': language,
        'kind': kind,
        'status': status,
        'access': access,
        'previewParts': previewParts,
        'volumes': volumes,
        'genre': genre,
        'rating': rating,
        'owner': {'handle': ownerHandle, 'displayName': ownerName},
        'lastPublicAt': lastPublicAt?.toIso8601String(),
        '_count': {'parts': publicParts, 'follows': followers},
      };
}

class PartSummary {
  PartSummary({
    required this.id,
    required this.workId,
    required this.position,
    required this.title,
    required this.kind,
    required this.state,
    required this.readMinutes,
    required this.version,
    this.publicAt,
    this.locked = false,
    this.progress,
    this.volume = 1,
    this.audioMime,
    this.audioSeconds,
    this.likes,
  });
  final String id, workId, title, kind, state;
  final int position, readMinutes, version, volume;
  final DateTime? publicAt;
  final bool locked;
  final Progress? progress;
  final String? audioMime, likes;
  final int? audioSeconds;
  bool get hasAudio => audioMime != null;

  factory PartSummary.fromJson(Map<String, dynamic> j) => PartSummary(
        id: j['id'] as String,
        workId: (j['workId'] as String?) ?? '',
        position: j['position'] as int,
        title: j['title'] as String,
        kind: (j['kind'] as String?) ?? 'chapter',
        state: (j['state'] as String?) ?? 'public',
        readMinutes: (j['readMinutes'] as int?) ?? 1,
        version: (j['version'] as int?) ?? 0,
        publicAt: j['publicAt'] != null ? DateTime.tryParse(j['publicAt'] as String) : null,
        locked: (j['locked'] as bool?) ?? false,
        progress: j['progress'] is Map ? Progress.fromJson(j['progress'] as Map<String, dynamic>) : null,
        volume: (j['volume'] as int?) ?? 1,
        audioMime: j['audioMime'] as String?,
        audioSeconds: j['audioSeconds'] as int?,
        likes: j['likes']?.toString(),
      );
}

class Progress {
  Progress({required this.paragraphIndex, required this.fraction, required this.finished, this.updatedAt});
  final int paragraphIndex;
  final double fraction;
  final bool finished;
  final DateTime? updatedAt;
  factory Progress.fromJson(Map<String, dynamic> j) => Progress(
        paragraphIndex: (j['paragraphIndex'] as int?) ?? 0,
        fraction: ((j['fraction'] as num?) ?? 0).toDouble(),
        finished: (j['finished'] as bool?) ?? false,
        updatedAt: j['updatedAt'] != null ? DateTime.tryParse(j['updatedAt'] as String) : null,
      );
}

class WorkPage {
  WorkPage({required this.work, required this.parts, required this.following, required this.liked, required this.likes, required this.readers, required this.followers, required this.stars, required this.isOwner, this.nextRelease});
  final WorkCard work;
  final List<PartSummary> parts;
  final bool following, liked, isOwner;
  final String likes, readers, followers;
  final Map<String, dynamic> stars;
  final Map<String, dynamic>? nextRelease;

  factory WorkPage.fromJson(Map<String, dynamic> j) => WorkPage(
        work: WorkCard.fromJson(j),
        parts: (j['parts'] as List).map((p) => PartSummary.fromJson(p as Map<String, dynamic>)).toList(),
        following: (j['following'] as bool?) ?? false,
        liked: (j['liked'] as bool?) ?? false,
        isOwner: (j['isOwner'] as bool?) ?? false,
        likes: j['likes'].toString(),
        readers: j['readers'].toString(),
        followers: j['followers'].toString(),
        stars: (j['stars'] as Map<String, dynamic>?) ?? const {},
        nextRelease: j['nextRelease'] as Map<String, dynamic>?,
      );
}

class PartPage {
  PartPage({required this.part, required this.workTitle, required this.workSlug, required this.workKind, required this.ownerName, required this.language, required this.bodyJson, this.prevPosition, this.next, this.progress, this.liked = false, this.hasAudio = false});
  final PartSummary part;
  final String workTitle, workSlug, workKind, ownerName, language;
  final Map<String, dynamic>? bodyJson;
  final int? prevPosition;
  final Map<String, dynamic>? next;
  final Progress? progress;
  final bool liked, hasAudio;

  factory PartPage.fromJson(Map<String, dynamic> j) {
    final w = j['work'] as Map<String, dynamic>;
    final p = j['part'] as Map<String, dynamic>;
    return PartPage(
      part: PartSummary.fromJson(p),
      workTitle: w['title'] as String,
      workSlug: w['slug'] as String,
      workKind: (w['kind'] as String?) ?? 'book',
      ownerName: ((w['owner'] as Map<String, dynamic>?)?['displayName'] as String?) ?? '',
      language: (w['language'] as String?) ?? 'sw',
      bodyJson: p['bodyJson'] as Map<String, dynamic>?,
      prevPosition: (j['prev'] as Map<String, dynamic>?)?['position'] as int?,
      next: j['next'] as Map<String, dynamic>?,
      progress: j['progress'] is Map ? Progress.fromJson(j['progress'] as Map<String, dynamic>) : null,
      liked: (j['liked'] as bool?) ?? false,
      hasAudio: j['audio'] != null,
    );
  }
}

class LibraryItem {
  LibraryItem({required this.work, this.currentPosition, this.currentTitle, this.finishedParts = 0, this.totalParts = 0, this.unread = 0, this.done = false});
  final WorkCard work;
  final int? currentPosition;
  final String? currentTitle;
  final int finishedParts, totalParts, unread;
  final bool done;
  factory LibraryItem.fromJson(Map<String, dynamic> j) {
    final cur = j['current'] as Map<String, dynamic>?;
    return LibraryItem(
      work: WorkCard.fromJson(j['work'] as Map<String, dynamic>),
      currentPosition: cur?['position'] as int?,
      currentTitle: cur?['title'] as String?,
      finishedParts: (j['finishedParts'] as int?) ?? 0,
      totalParts: (j['totalParts'] as int?) ?? 0,
      unread: (j['unread'] as int?) ?? 0,
      done: (j['done'] as bool?) ?? false,
    );
  }
}

class AppNotification {
  AppNotification({required this.id, required this.kind, required this.title, required this.body, this.link, this.readAt, required this.createdAt});
  final String id, kind, title, body;
  final String? link;
  final DateTime? readAt;
  final DateTime createdAt;
  factory AppNotification.fromJson(Map<String, dynamic> j) => AppNotification(
        id: j['id'] as String,
        kind: (j['kind'] as String?) ?? 'release',
        title: (j['title'] as String?) ?? '',
        body: (j['body'] as String?) ?? '',
        link: j['link'] as String?,
        readAt: j['readAt'] != null ? DateTime.tryParse(j['readAt'] as String) : null,
        createdAt: DateTime.tryParse((j['createdAt'] as String?) ?? '') ?? DateTime.now(),
      );
}
