package resolver

import "testing"

func TestCommentCountModel(t *testing.T) {
	t.Parallel()
	if commentCountModel(nil) != nil {
		t.Fatal("unknown count must remain null")
	}
	for _, count := range []int64{0, 1, 500, -1, 1 << 32} {
		value := commentCountModel(&count)
		if count < 0 || count > 1<<31-1 {
			if value != nil {
				t.Fatal("invalid count accepted")
			}
		} else if value == nil || int64(*value) != count {
			t.Fatal("count changed")
		}
	}
}
